import {
  getCanonicalMcpResourceUri,
  MCP_PHASE1_SCOPES,
  normalizeResourceUri,
  parseScopeString,
} from '@durabull/mcp/auth'

const OPENID_SCOPE = 'openid'

/**
 * Normalize MCP authorize requests for third-party clients (e.g. Linear) that omit
 * `prompt=consent` and request no or minimal `mcp:*` scopes.
 *
 * Without `prompt=consent`, Better Auth may auto-approve using a prior narrow
 * `oauth_consent` row (often only `mcp:discover`), which blocks jobs/logs tools.
 */
export function ensureMcpAuthorizeScopes(url: URL, appBaseUrl: string): URL {
  if (!url.pathname.endsWith('/mcp/authorize')) {
    return url
  }

  const resource = url.searchParams.get('resource')
  if (!resource) {
    return url
  }

  const canonicalResource = getCanonicalMcpResourceUri(appBaseUrl)
  if (normalizeResourceUri(resource) !== normalizeResourceUri(canonicalResource)) {
    return url
  }

  const mergedScopes = new Set(parseScopeString(url.searchParams.get('scope') ?? ''))
  let changed = false

  if (!mergedScopes.has(OPENID_SCOPE)) {
    mergedScopes.add(OPENID_SCOPE)
    changed = true
  }

  for (const scope of MCP_PHASE1_SCOPES) {
    if (!mergedScopes.has(scope)) {
      mergedScopes.add(scope)
      changed = true
    }
  }

  const prompt = url.searchParams.get('prompt')
  const needsConsentPrompt = !prompt || prompt === 'none'
  if (needsConsentPrompt) {
    changed = true
  }

  if (!changed) {
    return url
  }

  const rewritten = new URL(url.toString())
  rewritten.searchParams.set('scope', Array.from(mergedScopes).join(' '))
  if (needsConsentPrompt) {
    rewritten.searchParams.set('prompt', 'consent')
  }
  return rewritten
}
