import { describe, expect, it, mock } from 'bun:test'

import { createBoundedAsyncQueue } from './bounded-async-queue'

describe('createBoundedAsyncQueue', () => {
  it('rejects invalid queue limits at construction time', () => {
    expect(() =>
      createBoundedAsyncQueue<string>({
        maxInFlight: 0,
        maxQueueDepth: 1,
      })
    ).toThrow('maxInFlight must be a positive integer')

    expect(() =>
      createBoundedAsyncQueue<string>({
        maxInFlight: 1,
        maxQueueDepth: -1,
      })
    ).toThrow('maxQueueDepth must be a non-negative integer')
  })

  it('bounds pending work and reports drops', () => {
    const onDrop = mock(() => {})
    const queue = createBoundedAsyncQueue<string>({
      maxInFlight: 1,
      maxQueueDepth: 2,
      onDrop,
    })
    const process = mock(async () => new Promise<void>(() => {}))

    expect(queue.enqueue('one', process)).toBe(true)
    expect(queue.enqueue('two', process)).toBe(true)
    expect(queue.enqueue('three', process)).toBe(true)
    expect(queue.enqueue('four', process)).toBe(false)

    expect(queue.getState()).toEqual({
      dropped: 1,
      inFlight: 1,
      queued: 2,
    })
    expect(onDrop).toHaveBeenCalledWith('four', {
      dropped: 1,
      inFlight: 1,
      queued: 2,
    })
  })

  it('uses each pending item processor when workers free up', async () => {
    let resolveFirst!: () => void
    const firstRun = new Promise<void>((resolve) => {
      resolveFirst = resolve
    })
    const processed: string[] = []
    const queue = createBoundedAsyncQueue<string>({
      maxInFlight: 1,
      maxQueueDepth: 2,
    })
    const firstProcessor = mock(async (input: string) => {
      processed.push(`first:${input}`)
      await firstRun
    })
    const secondProcessor = mock(async (input: string) => {
      processed.push(`second:${input}`)
    })

    expect(queue.enqueue('one', firstProcessor)).toBe(true)
    expect(queue.enqueue('two', secondProcessor)).toBe(true)

    resolveFirst()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(processed).toEqual(['first:one', 'second:two'])
  })

  it('recovers capacity when a processor throws synchronously', async () => {
    const onError = mock(() => {})
    const queue = createBoundedAsyncQueue<string>({
      maxInFlight: 1,
      maxQueueDepth: 0,
      onError,
    })

    expect(
      queue.enqueue('one', () => {
        throw new Error('boom')
      })
    ).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onError).toHaveBeenCalledTimes(1)
    expect(queue.getState()).toEqual({
      dropped: 0,
      inFlight: 0,
      queued: 0,
    })
    expect(queue.enqueue('two', async () => {})).toBe(true)
  })

  it('ignores stale in-flight completions after a test reset', async () => {
    let resolveFirst!: () => void
    const firstRun = new Promise<void>((resolve) => {
      resolveFirst = resolve
    })
    const onResult = mock(() => {})
    const queue = createBoundedAsyncQueue<string>({
      maxInFlight: 1,
      maxQueueDepth: 1,
      onResult,
    })

    expect(queue.enqueue('one', async () => firstRun)).toBe(true)
    queue.resetForTests()
    expect(queue.enqueue('two', async () => {})).toBe(true)

    resolveFirst()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(queue.getState()).toEqual({
      dropped: 0,
      inFlight: 0,
      queued: 0,
    })
    expect(onResult).toHaveBeenCalledTimes(1)
  })
})
