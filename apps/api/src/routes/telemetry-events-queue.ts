import {
  captureAnonymousServerEvent,
  tryGetServerAnalyticsOptions,
} from '@durabull/analytics/server'
import { createBoundedAsyncQueue } from '../lib/bounded-async-queue'
import { recordTelemetryQueueDrop } from '../lib/telemetry-queue-metrics'

interface TelemetryEventQueueItem {
  event: string
  properties: Record<string, unknown>
  sessionId: string
  timestamp: string
}

const MAX_EVENTS_IN_FLIGHT = 4
const MAX_EVENTS_QUEUE_DEPTH = 256

type ProcessTelemetryEvent = (input: TelemetryEventQueueItem) => Promise<void>

async function processTelemetryEvent(input: TelemetryEventQueueItem): Promise<void> {
  const options = tryGetServerAnalyticsOptions()
  if (!options?.enabled) return

  const anonymousInstanceId = await options.resolveAnonymousInstanceId()
  await captureAnonymousServerEvent({
    anonymousInstanceId,
    event: input.event,
    properties: input.properties,
    sessionId: input.sessionId,
    timestamp: input.timestamp,
  })
}

const eventsQueue = createBoundedAsyncQueue<TelemetryEventQueueItem>({
  maxInFlight: MAX_EVENTS_IN_FLIGHT,
  maxQueueDepth: MAX_EVENTS_QUEUE_DEPTH,
  onDrop: (_input, state) => {
    recordTelemetryQueueDrop({
      dropped: state.dropped,
      inFlight: state.inFlight,
      queueName: 'telemetry_events',
      queued: state.queued,
    })
  },
  onError: () => {
    // Local telemetry must never affect the product experience.
  },
})

export function enqueueTelemetryEvent(
  input: TelemetryEventQueueItem,
  process: ProcessTelemetryEvent = processTelemetryEvent
): boolean {
  return eventsQueue.enqueue(input, process)
}

/** Test-only */
export function resetTelemetryEventsQueueForTests(): void {
  eventsQueue.resetForTests()
}
