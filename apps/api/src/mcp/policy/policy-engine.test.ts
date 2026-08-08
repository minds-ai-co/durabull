import { describe, expect, it } from 'bun:test'

import type { McpSession } from '../auth/mcp-session-middleware'
import { evaluateMcpToolPolicy } from './policy-engine'
import type { McpPrincipal } from './types'

const baseSession: McpSession = {
  accessToken: 'token',
  refreshToken: 'refresh',
  accessTokenExpiresAt: new Date(),
  refreshTokenExpiresAt: new Date(),
  clientId: 'client-id',
  userId: 'user-1',
  scopes:
    'mcp:discover mcp:jobs:read mcp:logs:read mcp:failures:read mcp:diagnostics:read',
}

const diagnosticsSession: McpSession = {
  ...baseSession,
  scopes:
    'mcp:discover mcp:diagnostics:read mcp:jobs:read mcp:logs:read mcp:failures:read',
}

const delegatedPrincipal: McpPrincipal = {
  type: 'delegated_user',
  principalId: 'principal-1',
  userId: 'user-1',
  organizationId: null,
}

describe('evaluateMcpToolPolicy', () => {
  it('denies tools without explicit scope mapping', async () => {
    const decision = await evaluateMcpToolPolicy({
      correlationId: 'corr-1',
      principal: delegatedPrincipal,
      session: baseSession,
      call: {
        toolName: 'unmapped_future_tool',
        arguments: {},
        connectionId: null,
      },
    })

    expect(decision.granted).toBe(false)
    expect(decision.denialReason).toBe('policy_configuration_missing')
    expect(decision.requiredScopes).toEqual([])
  })

  it('maps diagnostic tools to failures and diagnostics scopes', async () => {
    const failuresDecision = await evaluateMcpToolPolicy({
      correlationId: 'corr-2',
      principal: delegatedPrincipal,
      session: baseSession,
      call: {
        toolName: 'get_failure_events',
        arguments: {},
        connectionId: null,
      },
    })

    expect(failuresDecision.requiredScopes).toEqual(['mcp:failures:read'])
    expect(failuresDecision.granted).toBe(true)

    const diagnosticsDecision = await evaluateMcpToolPolicy({
      correlationId: 'corr-3',
      principal: delegatedPrincipal,
      session: diagnosticsSession,
      call: {
        toolName: 'explain_job_failure',
        arguments: {},
        connectionId: null,
      },
    })

    expect(diagnosticsDecision.requiredScopes).toEqual([
      'mcp:diagnostics:read',
      'mcp:jobs:read',
      'mcp:logs:read',
      'mcp:failures:read',
    ])
    expect(diagnosticsDecision.granted).toBe(true)
  })
})
