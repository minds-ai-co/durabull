import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { AnalyticsEvents } from '@durabull/analytics/events'
import { env } from '@durabull/env'

const captureMcpAnalyticsServerEvent = mock(async () => {})

mock.module('@durabull/analytics/server', () => ({
  captureMcpAnalyticsServerEvent,
  hashMcpAnalyticsSessionId: (value: string) => `session-${value}`,
  shouldDedupeIdentifiedPosthogEvents: () => false,
  resolveIdentifiedDistinctIds: ({
    userId,
    organizationId,
  }: {
    userId?: string
    organizationId?: string
  }) => {
    if (userId) {
      return { distinctId: `hashed-user:${userId}`, organizationGroup: null }
    }
    if (organizationId) {
      return {
        distinctId: `hashed-org:${organizationId}`,
        organizationGroup: `hashed-org:${organizationId}`,
      }
    }
    return { distinctId: null, organizationGroup: null }
  },
  tryGetServerAnalyticsOptions: () => ({
    enabled: true,
    hmacSecret: 'test-secret',
    resolveAnonymousInstanceId: async () => 'test-instance-id',
  }),
  configureServerAnalytics: () => undefined,
  resetServerAnalyticsForTests: () => undefined,
}))

const { recordMcpAnalytics, recordMcpTelemetryAnalytics } = await import('./mcp-analytics')
const { resetMcpAnalyticsQueueForTests } = await import('./mcp-analytics-queue')
const { resetMcpTelemetryForTests } = await import('./mcp-telemetry')

const mutableEnv = env as {
  BETTER_AUTH_SECRET?: string
  CI?: boolean
  NODE_ENV?: 'development' | 'test' | 'production'
}

const originalNodeEnv = mutableEnv.NODE_ENV
const originalCi = mutableEnv.CI
const originalSecret = mutableEnv.BETTER_AUTH_SECRET

describe('mcp analytics', () => {
  beforeEach(() => {
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.CI = false
    mutableEnv.BETTER_AUTH_SECRET = 'test-secret'
    resetMcpTelemetryForTests()
    resetMcpAnalyticsQueueForTests()
    captureMcpAnalyticsServerEvent.mockClear()
  })

  afterEach(() => {
    mutableEnv.NODE_ENV = originalNodeEnv
    mutableEnv.CI = originalCi
    mutableEnv.BETTER_AUTH_SECRET = originalSecret
  })

  it('maps tool success telemetry to mcp_tool_called analytics', async () => {
    recordMcpTelemetryAnalytics('tool_success', {
      toolName: 'list_jobs',
      principalId: 'principal-1',
      principalType: 'delegated_user',
      userId: 'user-1',
      organizationId: null,
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(captureMcpAnalyticsServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AnalyticsEvents.MCP_TOOL_CALLED,
        identifiedDistinctId: 'hashed-user:user-1',
        includeAnonymous: true,
        properties: expect.objectContaining({
          tool_name: 'list_jobs',
          response_class: 'success',
        }),
      })
    )
  })

  it('records anonymous-only auth failures without identity', async () => {
    recordMcpTelemetryAnalytics('auth_missing_bearer', {})

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(captureMcpAnalyticsServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AnalyticsEvents.MCP_AUTH_FAILED,
        identifiedDistinctId: null,
        properties: expect.objectContaining({
          mcp_auth_failure: 'missing_bearer',
        }),
      })
    )
  })

  it('records rpc requests for service accounts with hashed org distinct id', async () => {
    recordMcpAnalytics({
      event: AnalyticsEvents.MCP_RPC_REQUESTED,
      properties: { mcp_method: 'tools/list' },
      identity: {
        principalType: 'service_account',
        principalId: 'sa-1',
        organizationId: 'org-1',
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(captureMcpAnalyticsServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        identifiedDistinctId: 'hashed-org:org-1',
        // Raw org id is forwarded so capture hashes it exactly once (no double-hash).
        organizationId: 'org-1',
      })
    )
  })

  it('does not emit product analytics for redaction-only signals', async () => {
    recordMcpTelemetryAnalytics('redaction_applied', {
      toolName: 'list_jobs',
      principalId: 'principal-1',
      principalType: 'delegated_user',
      userId: 'user-1',
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(captureMcpAnalyticsServerEvent).not.toHaveBeenCalled()
  })
})
