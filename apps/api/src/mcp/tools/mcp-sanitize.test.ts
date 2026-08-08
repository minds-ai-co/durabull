import { describe, expect, it } from 'bun:test'

import { sanitizeMcpOutput } from './mcp-sanitize'

describe('mcp-sanitize api helpers', () => {
  it('sanitizes alert event summaries without leaking redis URLs', () => {
    const { value, redactionCount } = sanitizeMcpOutput({
      summary: 'Worker failed connecting to redis://:secret@host:6379/0',
    })

    expect(JSON.stringify(value)).not.toContain('redis://')
    expect(redactionCount).toBeGreaterThan(0)
  })
})
