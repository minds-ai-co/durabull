import { describe, expect, it } from 'bun:test'

import { sanitizeMcpOutput, sanitizeMcpText } from './sanitize-output'

describe('sanitizeMcpOutput', () => {
  it('redacts redis URLs in nested job payloads', () => {
    const { value, redactionCount } = sanitizeMcpOutput({
      job: {
        data: {
          callback: 'redis://:secret@host:6379/0',
        },
      },
    })

    expect(JSON.stringify(value)).not.toContain('redis://')
    expect(JSON.stringify(value)).toContain('[redacted]')
    expect(redactionCount).toBeGreaterThan(0)
  })

  it('drops sensitive object keys', () => {
    const { value, redactionCount } = sanitizeMcpOutput({
      apiKey: 'abc123',
      name: 'worker-1',
    })

    expect(value).toEqual({ name: 'worker-1' })
    expect(redactionCount).toBe(1)
  })

  it('redacts bearer tokens in log lines', () => {
    const { value, redactionCount } = sanitizeMcpOutput({
      logs: ['Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.token'],
    })

    expect(JSON.stringify(value)).toContain('[redacted]')
    expect(redactionCount).toBeGreaterThan(0)
  })

  it('preserves benign url field names while redacting secret values', () => {
    const { value, redactionCount } = sanitizeMcpOutput({
      callbackUrl: 'https://example.com/hooks',
      apiKey: 'should-drop-key',
    })

    expect(value).toEqual({ callbackUrl: 'https://example.com/hooks' })
    expect(redactionCount).toBe(1)
  })

  it('redacts jwt-like strings in generic payload fields', () => {
    const { value, redactionCount } = sanitizeMcpOutput({
      message: 'token eyJabc.def.ghi failed',
    })

    expect(JSON.stringify(value)).toContain('[redacted]')
    expect(redactionCount).toBeGreaterThan(0)
  })
})

describe('sanitizeMcpText', () => {
  it('returns null for empty strings after redaction', () => {
    expect(sanitizeMcpText('   ')).toBeNull()
  })
})
