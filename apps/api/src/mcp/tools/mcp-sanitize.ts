import {
  sanitizeMcpText as sanitizeMcpTextImpl,
  truncateMcpText as truncateMcpTextImpl,
} from '@durabull/mcp/safety/sanitize-output'

export { sanitizeMcpOutput } from '@durabull/mcp/safety/sanitize-output'

const SENSITIVE_KEY =
  /(^|_)(secret|password|authorization|api[_-]?key|credential|private[_-]?key|redis[_-]?url|connection[_-]?url|access[_-]?token)(_|$)/i
const MAX_CONTEXT_DEPTH = 4
const MAX_CONTEXT_ARRAY_ITEMS = 50

export const truncateMcpText = truncateMcpTextImpl
export const sanitizeMcpText = sanitizeMcpTextImpl

export function sanitizeAlertEventContext(
  context: unknown,
  depth = 0
): Record<string, unknown> | null {
  if (context == null || depth > MAX_CONTEXT_DEPTH) {
    return null
  }

  if (Array.isArray(context)) {
    const items = context
      .slice(0, MAX_CONTEXT_ARRAY_ITEMS)
      .map((item) => sanitizeAlertContextValue(item, depth + 1))
      .filter((item) => item !== undefined)
    return items.length > 0 ? { items } : null
  }

  if (typeof context !== 'object') {
    return null
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      continue
    }
    const next = sanitizeAlertContextValue(value, depth + 1)
    if (next !== undefined) {
      sanitized[key] = next
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null
}

function sanitizeAlertContextValue(value: unknown, depth: number): unknown | undefined {
  if (value == null) return value
  if (typeof value === 'string') {
    return sanitizeMcpText(value) ?? undefined
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    const nested = sanitizeAlertEventContext(value, depth)
    return nested ?? undefined
  }
  if (typeof value === 'object') {
    const nested = sanitizeAlertEventContext(value, depth)
    return nested ?? undefined
  }
  return undefined
}

export function toMcpAlertEventSummary(event: {
  id: string
  alertRuleId: string
  queueName: string
  type: string
  status: string
  summary: string
  firedAt: Date
  resolvedAt: Date | null
  context: unknown
}) {
  return {
    id: event.id,
    alertRuleId: event.alertRuleId,
    queueName: event.queueName,
    type: event.type,
    status: event.status,
    summary: sanitizeMcpText(event.summary) ?? '',
    firedAt: event.firedAt.toISOString(),
    resolvedAt: event.resolvedAt?.toISOString() ?? null,
    context: sanitizeAlertEventContext(event.context),
  }
}
