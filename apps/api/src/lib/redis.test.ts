import { beforeEach, describe, expect, it, mock } from 'bun:test'

const queueInstances: Array<{
  name: string
  opts: { prefix?: string; skipMetasUpdate?: boolean; connection?: { url?: string } }
}> = []
const scanCalls: Array<Array<string | number>> = []
let importId = 0

async function importFreshRedis(): Promise<typeof import('./redis')> {
  importId += 1
  return import(`./redis?redis-prefix-test=${importId}`) as Promise<typeof import('./redis')>
}

mock.module('bullmq', () => ({
  Queue: class MockQueue {
    name: string
    opts: { prefix?: string; skipMetasUpdate?: boolean; connection?: { url?: string } }

    constructor(
      name: string,
      opts: { prefix?: string; skipMetasUpdate?: boolean; connection?: { url?: string } }
    ) {
      this.name = name
      this.opts = opts
      queueInstances.push(this)
    }

    on() {}

    async close() {}
  },
}))

mock.module('ioredis', () => ({
  Redis: class MockRedis {
    status = 'ready'

    constructor(
      readonly url: string,
      readonly opts: unknown
    ) {}

    async connect() {}

    on() {}

    disconnect() {}

    async scan(...args: Array<string | number>): Promise<[string, string[]]> {
      scanCalls.push(args)
      return ['0', []]
    }
  },
}))

describe('redis queue prefix handling', () => {
  beforeEach(() => {
    queueInstances.length = 0
    scanCalls.length = 0
  })

  it('caches queues separately by connection URL and prefix', async () => {
    const { getQueue } = await importFreshRedis()

    const first = await getQueue('conn-1', 'redis://localhost:6379/0', 'email', 'bull')
    const same = await getQueue('conn-1', 'redis://localhost:6379/0', 'email', 'bull')
    const differentPrefix = await getQueue(
      'conn-1',
      'redis://localhost:6379/0',
      'email',
      'tenant-a'
    )
    const differentUrl = await getQueue('conn-1', 'redis://localhost:6379/1', 'email', 'bull')

    expect(same).toBe(first)
    expect(differentPrefix).not.toBe(first)
    expect(differentUrl).not.toBe(first)
    expect(queueInstances.map((queue) => queue.opts.prefix)).toContain('tenant-a')
    expect(queueInstances.map((queue) => queue.opts.connection?.url)).toContain(
      'redis://localhost:6379/1'
    )
  })

  it('never overwrites the observed queue metadata', async () => {
    const { getQueue } = await importFreshRedis()

    await getQueue('conn-1', 'redis://localhost:6379/0', 'observed', 'bull')

    expect(queueInstances.at(-1)?.opts.skipMetasUpdate).toBe(true)
  })

  it('escapes prefix glob characters when scanning queue metadata', async () => {
    const { debugGetBullKeys, scanQueuesPage } = await importFreshRedis()

    await scanQueuesPage('conn-2', 'redis://localhost:6379/0', '0', 100, 'bull\\prod[1]*?')
    await debugGetBullKeys('conn-3', 'redis://localhost:6379/0', 'bull\\prod[1]*?')

    expect(scanCalls[0]).toEqual(['0', 'MATCH', 'bull\\\\prod\\[1\\]\\*\\?:*:meta', 'COUNT', 100])
    expect(scanCalls[1]).toEqual(['0', 'MATCH', 'bull\\\\prod\\[1\\]\\*\\?:*', 'COUNT', 100])
  })
})
