import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { Hono } from 'hono'

import {
  createMcpToolRateLimitMiddleware,
  resetMcpToolRateLimitStoreForTests,
  setMcpToolRateLimitBypassForTests,
} from './mcp-tool-rate-limit'

describe('createMcpToolRateLimitMiddleware', () => {
  beforeEach(() => {
    resetMcpToolRateLimitStoreForTests()
    setMcpToolRateLimitBypassForTests(true)
  })

  afterEach(() => {
    resetMcpToolRateLimitStoreForTests()
    setMcpToolRateLimitBypassForTests(false)
  })

  it('returns JSON-RPC 429 when per-tool limit is exceeded', async () => {
    const app = new Hono()
    app.use('*', createMcpToolRateLimitMiddleware())
    app.post('/', (c) => c.json({ ok: true }))

    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'get_job_logs',
        arguments: { connectionId: 'conn-1' },
      },
    }

    const headers = {
      Authorization: 'Bearer test-token',
      'x-forwarded-for': '203.0.113.44',
    }

    let lastStatus = 200
    for (let i = 0; i < 31; i += 1) {
      const response = await app.request('/', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      lastStatus = response.status
    }

    expect(lastStatus).toBe(429)
  })
})
