import { describe, expect, it } from 'bun:test'

import { hashMcpToolInput } from '../audit/mcp-audit'

describe('hashMcpToolInput', () => {
  it('hashes stable argument ordering', () => {
    const first = hashMcpToolInput({ connectionId: 'abc', queueName: 'mail' })
    const second = hashMcpToolInput({ queueName: 'mail', connectionId: 'abc' })
    expect(first).toBe(second)
    expect(first).toHaveLength(64)
  })

  it('includes nested argument keys in the hash', () => {
    const first = hashMcpToolInput({
      connectionId: 'abc',
      nested: { queueName: 'mail', jobId: '1' },
    })
    const second = hashMcpToolInput({
      nested: { jobId: '1', queueName: 'mail' },
      connectionId: 'abc',
    })
    const shallowOnly = hashMcpToolInput({
      connectionId: 'abc',
      nested: {},
    })

    expect(first).toBe(second)
    expect(first).not.toBe(shallowOnly)
  })
})
