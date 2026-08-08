import type { ListConnectionsHandlerInput } from '@durabull/mcp'

import { resolveConnectionForPrincipal } from '../connections/resolve-connection'

export type ToolPrincipal = ListConnectionsHandlerInput['principal']

export class McpToolError extends Error {
  readonly code: 'not_found' | 'validation_error' | 'internal_error'

  constructor(code: 'not_found' | 'validation_error' | 'internal_error', message: string) {
    super(message)
    this.name = 'McpToolError'
    this.code = code
  }
}

export async function requireConnectionForPrincipal(
  principal: ToolPrincipal,
  connectionId: string
) {
  const connection = await resolveConnectionForPrincipal(principal, connectionId)
  if (!connection) {
    throw new McpToolError('not_found', `Connection ${connectionId} not found.`)
  }
  return connection
}

export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0
  const parsed = Number.parseInt(cursor, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new McpToolError('validation_error', 'Invalid cursor.')
  }
  return parsed
}

export function encodeCursor(offset: number): string {
  return String(offset)
}

export function parseOffsetPageSize(cursor: string | undefined, pageSize: number): {
  offset: number
  limit: number
} {
  return {
    offset: decodeCursor(cursor),
    limit: Math.min(100, Math.max(1, pageSize)),
  }
}

export function parseWorkersCursor(cursor: string | undefined): {
  queueIndex: number
  workerOffset: number
} {
  if (!cursor) {
    return { queueIndex: 0, workerOffset: 0 }
  }

  const [queuePart, workerPart] = cursor.split(':')
  const queueIndex = Number.parseInt(queuePart ?? '', 10)
  const workerOffset = Number.parseInt(workerPart ?? '', 10)
  if (
    !Number.isFinite(queueIndex) ||
    queueIndex < 0 ||
    !Number.isFinite(workerOffset) ||
    workerOffset < 0
  ) {
    throw new McpToolError('validation_error', 'Invalid cursor.')
  }

  return { queueIndex, workerOffset }
}

export function encodeWorkersCursor(queueIndex: number, workerOffset: number): string {
  return `${queueIndex}:${workerOffset}`
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const workerCount = Math.min(Math.max(1, concurrency), items.length)

  async function runWorker() {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) return
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return results
}
