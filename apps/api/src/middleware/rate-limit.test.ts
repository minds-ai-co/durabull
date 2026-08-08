import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { env } from '@durabull/env'
import { Hono } from 'hono'
import { apiRateLimiter, resetRateLimitStoreForTests } from './rate-limit'

const mutableEnv = env as {
  CI?: boolean
  DISABLE_RATE_LIMIT?: boolean
  DURABULL_CLOUD?: boolean
  NODE_ENV?: 'development' | 'test' | 'production'
  TRUST_PROXY?: boolean
}

const originalCi = mutableEnv.CI
const originalDisableRateLimit = mutableEnv.DISABLE_RATE_LIMIT
const originalDurabullCloud = mutableEnv.DURABULL_CLOUD
const originalNodeEnv = mutableEnv.NODE_ENV
const originalTrustProxy = mutableEnv.TRUST_PROXY

function createPingApp() {
  const app = new Hono()
  app.use('/api/*', apiRateLimiter)
  app.get('/api/ping', (c) => c.json({ ok: true }))
  return app
}

describe('apiRateLimiter', () => {
  beforeEach(() => {
    resetRateLimitStoreForTests()
    mutableEnv.CI = false
    mutableEnv.DISABLE_RATE_LIMIT = false
    mutableEnv.DURABULL_CLOUD = false
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.TRUST_PROXY = undefined
  })

  afterEach(() => {
    mutableEnv.CI = originalCi
    mutableEnv.DISABLE_RATE_LIMIT = originalDisableRateLimit
    mutableEnv.DURABULL_CLOUD = originalDurabullCloud
    mutableEnv.NODE_ENV = originalNodeEnv
    mutableEnv.TRUST_PROXY = originalTrustProxy
  })

  it('allows a normal multi-tab app startup burst from one client behind trusted proxy', async () => {
    mutableEnv.DURABULL_CLOUD = true
    const app = createPingApp()

    const responses = await Promise.all(
      Array.from({ length: 150 }, () =>
        app.request('/api/ping', {
          headers: { 'x-forwarded-for': '203.0.113.10' },
        })
      )
    )

    expect(responses.every((response) => response.status === 200)).toBe(true)
    expect(responses[0]?.headers.get('X-RateLimit-Limit')).toBe('600')
  })

  it('does not treat spoofed x-forwarded-for values as separate clients when proxy is untrusted', async () => {
    const app = createPingApp()

    const responses = await Promise.all(
      Array.from({ length: 601 }, (_, index) =>
        app.request('/api/ping', {
          headers: { 'x-forwarded-for': `203.0.113.${index % 250}` },
        })
      )
    )

    expect(responses.some((response) => response.status === 429)).toBe(true)
    expect(responses.filter((response) => response.status === 429).length).toBeGreaterThan(0)
  })

  it('does not treat spoofed x-forwarded-for leftmost hops as separate clients when proxy is trusted', async () => {
    mutableEnv.TRUST_PROXY = true
    const app = createPingApp()

    const responses = await Promise.all(
      Array.from({ length: 601 }, (_, index) =>
        app.request('/api/ping', {
          headers: {
            'cf-connecting-ip': '198.51.100.42',
            'x-forwarded-for': `${index}.0.0.1, 198.51.100.42`,
          },
        })
      )
    )

    expect(responses.some((response) => response.status === 429)).toBe(true)
  })

  it('honors x-forwarded-for when TRUST_PROXY is enabled', async () => {
    mutableEnv.TRUST_PROXY = true
    const app = createPingApp()

    const responses = await Promise.all(
      Array.from({ length: 601 }, (_, index) =>
        app.request('/api/ping', {
          headers: { 'x-forwarded-for': `198.51.100.${index % 250}` },
        })
      )
    )

    expect(responses.every((response) => response.status === 200)).toBe(true)
  })
})
