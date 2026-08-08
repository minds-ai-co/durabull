import { afterEach, describe, expect, it, mock } from 'bun:test'

import {
  getTelemetryQueueDropTotalsForTests,
  resetTelemetryQueueDropTotalsForTests,
} from '../lib/telemetry-queue-metrics'
import { enqueueTelemetryEvent, resetTelemetryEventsQueueForTests } from './telemetry-events-queue'

const originalInfo = console.info

describe('telemetry events queue', () => {
  afterEach(() => {
    console.info = originalInfo
    resetTelemetryEventsQueueForTests()
    resetTelemetryQueueDropTotalsForTests()
  })

  it('rejects new events and records a drop metric when the bounded queue is full', () => {
    const info = mock(() => {})
    console.info = info as unknown as typeof console.info
    const process = mock(async () => new Promise<void>(() => {}))
    const input = {
      event: 'queue_paused',
      properties: { success: true },
      sessionId: 'session-1',
      timestamp: '2026-05-28T00:00:00.000Z',
    }

    for (let i = 0; i < 4 + 256; i += 1) {
      expect(enqueueTelemetryEvent(input, process)).toBe(true)
    }

    expect(enqueueTelemetryEvent(input, process)).toBe(false)
    expect(getTelemetryQueueDropTotalsForTests().get('telemetry_events')).toBe(1)
    expect(info).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'telemetry_queue',
        signal: 'queue_dropped',
        queueName: 'telemetry_events',
        count: 1,
        dropped: 1,
        inFlight: 4,
        queued: 256,
      })
    )
  })
})
