import { mcpPolicyRepository } from '@durabull/dal'

import type { McpSession } from '../auth/mcp-session-middleware'
import type { McpPrincipal } from './types'

/**
 * Resolves the authenticated MCP caller into a delegated-user or service-account principal.
 */
export async function resolveMcpPrincipal(session: McpSession): Promise<McpPrincipal | null> {
  const serviceAccount =
    await mcpPolicyRepository.findServiceAccountByOauthClientIdIncludingDisabled(session.clientId)
  if (serviceAccount) {
    // Service-account oauth clients should resolve to machine principals only.
    // If the linked service account is disabled or a token unexpectedly carries
    // user identity, fail closed instead of falling back to delegated-user auth.
    if (serviceAccount.disabled || session.userId) {
      return null
    }

    return {
      type: 'service_account',
      principalId: serviceAccount.id,
      serviceAccountId: serviceAccount.id,
      organizationId: serviceAccount.organizationId,
    }
  }

  if (session.userId) {
    return {
      type: 'delegated_user',
      principalId: session.userId,
      userId: session.userId,
      organizationId: null,
    }
  }

  return null
}
