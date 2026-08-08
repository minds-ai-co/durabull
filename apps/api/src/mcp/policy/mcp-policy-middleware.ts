import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'

import type { McpSession } from '../auth/mcp-session-middleware'
import { hashMcpToolInput, writeMcpAuditEventNonBlocking } from '../audit/mcp-audit'
import {
  isMcpToolsCallMethod,
  parseMcpJsonRpcMethod,
  parseMcpJsonRpcPayloadId,
  parseMcpToolCallBody,
} from '../json-rpc-tool-call'
import { recordMcpRpcAnalytics, type McpAnalyticsIdentity } from '../observability/mcp-analytics'
import { resolveConnectionForPrincipal } from '../connections/resolve-connection'
import { evaluateMcpToolPolicy } from './policy-engine'
import { resolveMcpPrincipal } from './principal-resolver'
import type { McpPolicyDecision, McpPrincipal } from './types'

const RPC_ANALYTICS_METHODS = new Set(['initialize', 'tools/list'])

function buildCorrelationId(): string {
  return crypto.randomUUID()
}

function jsonRpcErrorResponse(
  c: Context,
  status: 400 | 403,
  code: number,
  message: string,
  id: string | number | null,
  data?: Record<string, unknown>
) {
  return c.json(
    {
      jsonrpc: '2.0',
      error: {
        code,
        message,
        ...(data ? { data } : {}),
      },
      id,
    },
    status
  )
}

async function readMcpRequestBody(c: Context): Promise<unknown> {
  const cached = c.get('mcpRequestJsonBody')
  if (cached !== undefined) {
    return cached
  }

  const body = await c.req.raw.clone().json().catch(() => null)
  c.set('mcpRequestJsonBody', body)
  return body
}

function policyDenialErrorData(decision: McpPolicyDecision): Record<string, unknown> {
  if (decision.denialReason?.startsWith('missing_scopes')) {
    return {
      code: 'insufficient_scope',
      requiredScopes: decision.requiredScopes,
    }
  }
  return { code: 'policy_denied' }
}

function principalToAnalyticsIdentity(principal: McpPrincipal): McpAnalyticsIdentity {
  return principal.type === 'delegated_user'
    ? {
        principalType: principal.type,
        principalId: principal.principalId,
        userId: principal.userId,
        organizationId: null,
      }
    : {
        principalType: principal.type,
        principalId: principal.principalId,
        organizationId: principal.organizationId,
      }
}

export function createMcpPolicyMiddleware() {
  return createMiddleware(async (c, next) => {
    if (c.req.method !== 'POST') {
      return next()
    }

    const body = await readMcpRequestBody(c)
    if (Array.isArray(body)) {
      return jsonRpcErrorResponse(
        c,
        400,
        -32_600,
        'Invalid Request: Batch MCP requests are not supported on this endpoint.',
        null
      )
    }

    const payloadId = parseMcpJsonRpcPayloadId(body)
    const toolCall = parseMcpToolCallBody(body)
    if (isMcpToolsCallMethod(body) && !toolCall) {
      return jsonRpcErrorResponse(
        c,
        400,
        -32_600,
        'Invalid Request: tools/call requires a valid params.name and arguments object.',
        payloadId
      )
    }
    if (!toolCall) {
      const mcpMethod = parseMcpJsonRpcMethod(body)
      if (mcpMethod && RPC_ANALYTICS_METHODS.has(mcpMethod)) {
        const session = c.get('mcpSession')
        const principal = await resolveMcpPrincipal(session)
        recordMcpRpcAnalytics({
          mcpMethod,
          identity: principal ? principalToAnalyticsIdentity(principal) : null,
        })
      }
      return next()
    }

    const session = c.get('mcpSession')
    const principal = await resolveMcpPrincipal(session)
    const correlationId = c.req.header('x-request-id') ?? buildCorrelationId()
    const inputHash = hashMcpToolInput(toolCall.arguments)

    if (!principal) {
      writeMcpAuditEventNonBlocking({
        correlationId,
        principalType: 'service_account',
        principalId: session.clientId,
        organizationId: null,
        connectionId: toolCall.connectionId,
        toolName: toolCall.toolName,
        requiredScopes: [],
        granted: false,
        denialReason: 'principal_resolution_failed',
        inputHash,
        responseClass: 'policy_denied',
      })

      return jsonRpcErrorResponse(
        c,
        403,
        -32_003,
        'Forbidden: MCP principal resolution failed for this token.',
        payloadId
      )
    }

    const decision = await evaluateMcpToolPolicy({
      correlationId,
      principal,
      session,
      call: toolCall,
    })

    if (!decision.granted) {
      writeMcpAuditEventNonBlocking({
        correlationId: decision.correlationId,
        principalType: decision.principalType,
        principalId: decision.principalId,
        userId: principal.type === 'delegated_user' ? principal.userId : null,
        organizationId: decision.organizationId,
        connectionId: decision.connectionId,
        toolName: decision.toolName,
        requiredScopes: decision.requiredScopes,
        granted: false,
        denialReason: decision.denialReason,
        inputHash,
        responseClass: 'policy_denied',
      })

      return jsonRpcErrorResponse(
        c,
        403,
        -32_003,
        'Forbidden: MCP policy denied this tool call.',
        payloadId,
        policyDenialErrorData(decision)
      )
    }

    if (toolCall.connectionId) {
      const principalForConnection =
        principal.type === 'delegated_user'
          ? {
              type: 'delegated_user' as const,
              principalId: principal.principalId,
              userId: principal.userId,
            }
          : {
              type: 'service_account' as const,
              principalId: principal.principalId,
              organizationId: principal.organizationId,
            }
      const resolvedConnection = await resolveConnectionForPrincipal(
        principalForConnection,
        toolCall.connectionId,
        { skipDelegatedAccessCheck: principal.type === 'delegated_user' }
      )
      if (resolvedConnection) {
        c.set('mcpResolvedConnection', resolvedConnection)
      }
    }

    c.set('mcpPrincipal', principal)
    c.set('mcpPolicyDecision', decision)
    c.set('mcpToolInputHash', inputHash)
    c.set(
      'mcpGrantedScopes',
      session.scopes
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter(Boolean)
    )
    return next()
  })
}

declare module 'hono' {
  interface ContextVariableMap {
    mcpRequestJsonBody: unknown
    mcpPrincipal: McpPrincipal
    mcpPolicyDecision: McpPolicyDecision
    mcpSession: McpSession
    mcpResolvedConnection?: import('@durabull/mcp').McpResolvedConnection
    mcpGrantedScopes?: string[]
    mcpToolInputHash?: string
  }
}
