import { describe, expect, it } from 'bun:test'
import { hashMcpAnalyticsSessionId, hashTelemetryIdentifier } from './identifiers'

describe('server identifiers', () => {
  it('hashes telemetry identifiers deterministically', () => {
    const secret = 'test-secret'
    expect(hashTelemetryIdentifier('instance:session', secret)).toBe(
      hashTelemetryIdentifier('instance:session', secret)
    )
    expect(hashTelemetryIdentifier('instance:session', secret)).not.toContain('instance')
  })

  it('hashes MCP session keys without exposing principal ids', () => {
    const hashed = hashMcpAnalyticsSessionId('principal-abc', 'test-secret')
    expect(hashed).toHaveLength(32)
    expect(hashed).not.toContain('principal')
  })
})
