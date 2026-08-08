import type { McpPrincipalType } from '@durabull/dal'

export type McpPrincipal =
  | {
      type: 'delegated_user'
      principalId: string
      userId: string
      organizationId: null
    }
  | {
      type: 'service_account'
      principalId: string
      serviceAccountId: string
      organizationId: string
    }

export interface McpPolicyDecision {
  correlationId: string
  principalType: McpPrincipalType
  principalId: string
  organizationId: string | null
  connectionId: string | null
  toolName: string
  requiredScopes: string[]
  granted: boolean
  denialReason: string | null
}

export interface McpToolCallRequest {
  toolName: string
  arguments: Record<string, unknown>
  connectionId: string | null
}
