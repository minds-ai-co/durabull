import type { ServerAnalyticsRuntimeContext } from './config'

export interface PosthogBatchCapture {
  event: string
  /** Already sanitized properties; runtime is not re-merged when mergeRuntime is false. */
  properties: Record<string, unknown>
  timestamp?: string
  distinctId: string
  processPersonProfile: boolean
  organizationId?: string | null
}

export interface PosthogBatchClientConfig {
  posthogBatchUrl: string
  posthogKey: string
}

export const DEFAULT_POSTHOG_BATCH_HOST = 'https://us.i.posthog.com'

/** Upper bound on a single PostHog ingest round-trip; prevents hung sockets from tying up workers. */
export const POSTHOG_FETCH_TIMEOUT_MS = 5_000

function isPrivateOrLinkLocalIpv4(hostname: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(hostname)
  if (!match) return false

  const octets = match.slice(1).map(Number)
  if (octets[0] === 127) return true
  if (octets[0] === 10) return true
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true
  if (octets[0] === 192 && octets[1] === 168) return true
  if (octets[0] === 169 && octets[1] === 254) return true
  return false
}

function isPrivateOrLinkLocalIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized === '::1') return true
  if (normalized.startsWith('fe80:')) return true
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) return true
  return false
}

/** HTTPS-only PostHog hostnames (*.posthog.com); rejects private/link-local IPs. */
export function isAllowedPosthogHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (isPrivateOrLinkLocalIpv4(normalized) || isPrivateOrLinkLocalIpv6(normalized)) {
    return false
  }

  return normalized === 'posthog.com' || normalized.endsWith('.posthog.com')
}

export function resolvePosthogBatchUrl(rawHost: string | undefined): string | null {
  const hostWithProtocol = rawHost?.trim()
    ? /^https?:\/\//i.test(rawHost)
      ? rawHost
      : `https://${rawHost}`
    : DEFAULT_POSTHOG_BATCH_HOST

  try {
    const parsed = new URL(hostWithProtocol)
    if (parsed.protocol !== 'https:') return null
    if (!isAllowedPosthogHostname(parsed.hostname)) return null

    const basePath = parsed.pathname.replace(/\/$/, '')
    const batchPath = basePath.endsWith('/batch') ? basePath : `${basePath}/batch`
    return `${parsed.origin}${batchPath}/`
  } catch {
    return null
  }
}

export async function sendPosthogBatch(
  config: PosthogBatchClientConfig,
  captures: PosthogBatchCapture[],
  options: {
    runtimeContext?: ServerAnalyticsRuntimeContext
    mergeRuntime?: boolean
  } = {}
): Promise<boolean> {
  if (captures.length === 0) return true

  const mergeRuntime = options.mergeRuntime ?? true
  const runtimeContext = options.runtimeContext ?? {
    authless: false,
    env_connections: false,
    environment: 'unknown',
    persistence: 'unknown',
    stateless: false,
  }

  const batch = captures.map((capture) => {
    const properties: Record<string, unknown> = {
      ...(mergeRuntime ? runtimeContext : {}),
      ...capture.properties,
      $geoip_disable: true,
      $process_person_profile: capture.processPersonProfile,
      distinct_id: capture.distinctId,
    }

    if (capture.organizationId) {
      properties.$groups = {
        organization: capture.organizationId,
      }
    }

    return {
      event: capture.event,
      properties,
      timestamp: capture.timestamp ?? new Date().toISOString(),
    }
  })

  const response = await fetch(config.posthogBatchUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: config.posthogKey,
      batch,
    }),
    redirect: 'manual',
    signal: AbortSignal.timeout(POSTHOG_FETCH_TIMEOUT_MS),
  })

  const isRedirect = response.status >= 300 && response.status < 400

  try {
    await response.body?.cancel()
  } catch {
    // Socket cleanup is best-effort only.
  }

  if (isRedirect) return false
  return response.ok
}
