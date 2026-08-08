import { AsyncLocalStorage } from 'node:async_hooks'

export interface McpRequestPrincipal {
  type: 'delegated_user' | 'service_account'
  principalId: string
  userId?: string
  organizationId?: string
}

export interface McpResolvedConnection {
  id: string
  organizationId: string
  url: string
  prefix: string
  allowSelfSignedCerts: boolean
}

export interface McpToolInvocationAuditInput {
  toolName: string
  arguments: Record<string, unknown>
  connectionId?: string | null
  responseClass: 'success' | 'tool_error'
  redactionCount?: number
}

export interface McpRequestContext {
  principal?: McpRequestPrincipal
  correlationId?: string
  grantedScopes?: string[]
  resolvedConnection?: McpResolvedConnection
  onToolInvocationComplete?: (input: McpToolInvocationAuditInput) => void
  onRedactionApplied?: (redactionCount: number) => void
}

const store = new AsyncLocalStorage<McpRequestContext>()

export function runWithMcpRequestContext<T>(
  context: McpRequestContext | undefined,
  fn: () => Promise<T> | T
): Promise<T> | T {
  if (!context) {
    return fn()
  }
  return store.run(context, fn)
}

export function getMcpRequestContext(): McpRequestContext | undefined {
  return store.getStore()
}
