export interface ParsedMcpToolCall {
  toolName: string
  arguments: Record<string, unknown>
  connectionId: string | null
  payloadId: string | number | null
}

interface JsonRpcToolCallBody {
  id?: string | number | null
  method?: string
  params?: {
    name?: string
    arguments?: Record<string, unknown>
  }
}

export function parseMcpJsonRpcPayloadId(body: unknown): string | number | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  if (!('id' in body)) return null
  const candidate = (body as { id?: unknown }).id
  return typeof candidate === 'string' ||
    typeof candidate === 'number' ||
    candidate === null ||
    candidate === undefined
    ? (candidate ?? null)
    : null
}

export function parseMcpToolCallBody(body: unknown): ParsedMcpToolCall | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const payload = body as JsonRpcToolCallBody
  if (payload.method !== 'tools/call') return null
  const toolName = payload.params?.name
  if (!toolName || typeof toolName !== 'string') return null
  const args = payload.params?.arguments
  const safeArgs: Record<string, unknown> =
    args && typeof args === 'object' && !Array.isArray(args) ? args : {}
  const connectionId =
    typeof safeArgs.connectionId === 'string' && safeArgs.connectionId.trim().length > 0
      ? safeArgs.connectionId.trim()
      : null

  return {
    toolName,
    arguments: safeArgs,
    connectionId,
    payloadId: parseMcpJsonRpcPayloadId(body),
  }
}

export function isMcpToolsCallMethod(body: unknown): boolean {
  return (
    body != null &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    (body as { method?: string }).method === 'tools/call'
  )
}

export function parseMcpJsonRpcMethod(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const method = (body as { method?: unknown }).method
  return typeof method === 'string' && method.trim().length > 0 ? method.trim() : null
}
