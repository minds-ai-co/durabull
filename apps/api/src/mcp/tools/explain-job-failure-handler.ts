import { alertEventRepository } from '@durabull/dal'
import type {
  ExplainJobFailureHandlerInput,
  ExplainJobFailureHandlerOutput,
} from '@durabull/mcp'

import { getQueue } from '../../lib/redis'
import { toRedisConnectionOptions } from '../../lib/connection-options'
import { McpToolError, requireConnectionForPrincipal } from './shared'
import { sanitizeMcpText, toMcpAlertEventSummary } from './mcp-sanitize'

interface ExplainJobFailureHandlerDeps {
  getQueue: typeof getQueue
  requireConnectionForPrincipal: typeof requireConnectionForPrincipal
  findAlertEvents: typeof alertEventRepository.findByConnection
  countAlertEvents: typeof alertEventRepository.countByConnection
}

const EXPLAIN_LOG_LINE_COUNT = 5

function pickTopSignal(input: {
  failedReason: string | null
  stacktrace: string | null
  logLines: string[]
}): ExplainJobFailureHandlerOutput['topSignal'] {
  const failedReason = sanitizeMcpText(input.failedReason)
  if (failedReason) {
    return {
      source: 'failed_reason',
      excerpt: failedReason,
    }
  }

  const stacktrace = sanitizeMcpText(input.stacktrace)
  if (stacktrace) {
    return {
      source: 'stacktrace',
      excerpt: stacktrace,
    }
  }

  const lastLog = [...input.logLines]
    .reverse()
    .map((line) => sanitizeMcpText(line))
    .find((line): line is string => !!line)
  if (lastLog) {
    return {
      source: 'logs',
      excerpt: lastLog,
    }
  }

  return {
    source: 'none',
    excerpt: 'No failure reason, stacktrace, or logs were available for this job.',
  }
}

function buildSummary(input: {
  queueName: string
  jobId: string
  status: string
  failedReason: string | null
  topSignal: ExplainJobFailureHandlerOutput['topSignal']
  alertCount: number
}): string {
  if (input.status !== 'failed') {
    return `Job ${input.jobId} in queue ${input.queueName} is currently "${input.status}", not failed.`
  }

  const signalLine =
    input.topSignal.source === 'none'
      ? 'No dominant failure signal was found in job metadata.'
      : `Top signal (${input.topSignal.source}): ${input.topSignal.excerpt}`

  const alertLine =
    input.alertCount > 0
      ? `${input.alertCount} related alert event(s) were found.`
      : 'No related alert events were found.'

  const reasonLine = input.failedReason
    ? `BullMQ failedReason: ${input.failedReason}`
    : 'BullMQ did not provide a failedReason.'

  return sanitizeMcpText([reasonLine, signalLine, alertLine].join(' ')) ?? ''
}

export function createExplainJobFailureHandler(
  deps: ExplainJobFailureHandlerDeps = {
    getQueue,
    requireConnectionForPrincipal,
    findAlertEvents: alertEventRepository.findByConnection,
    countAlertEvents: alertEventRepository.countByConnection,
  }
) {
  return async function explainJobFailureHandler(
    input: ExplainJobFailureHandlerInput
  ): Promise<ExplainJobFailureHandlerOutput> {
    const connection = await deps.requireConnectionForPrincipal(
      input.principal,
      input.connectionId
    )

    const queue = await deps.getQueue(
      connection.id,
      connection.url,
      input.queueName,
      connection.prefix,
      toRedisConnectionOptions(connection.allowSelfSignedCerts)
    )
    const job = await queue.getJob(input.jobId)
    if (!job) {
      throw new McpToolError('not_found', `Job ${input.jobId} not found in queue ${input.queueName}.`)
    }

    const alertFilters = {
      queueName: input.queueName,
      jobId: input.jobId,
    }

    const [status, logProbe, alertEvents, relatedAlertCount] = await Promise.all([
      job.getState(),
      queue.getJobLogs(input.jobId, 0, 0),
      deps.findAlertEvents(connection.id, connection.organizationId, {
        offset: 0,
        limit: 5,
        ...alertFilters,
      }),
      deps.countAlertEvents(connection.id, connection.organizationId, alertFilters),
    ])

    const logCount = logProbe.count ?? logProbe.logs?.length ?? 0
    const logStart = Math.max(0, logCount - EXPLAIN_LOG_LINE_COUNT)
    const logEnd = Math.max(0, logCount - 1)
    const logs =
      logCount === 0
        ? logProbe
        : await queue.getJobLogs(input.jobId, logStart, logEnd)

    const logLines = (logs.logs ?? [])
      .map((line) => sanitizeMcpText(line))
      .filter((line): line is string => !!line)

    const isFailed = status === 'failed'
    const failedReason = isFailed ? sanitizeMcpText(job.failedReason ?? null) : null
    const stacktraces = isFailed ? (job.stacktrace ?? []) : []
    const latestStacktrace =
      stacktraces.length > 0 ? sanitizeMcpText(stacktraces[stacktraces.length - 1] ?? null) : null

    const topSignal = isFailed
      ? pickTopSignal({
          failedReason,
          stacktrace: latestStacktrace,
          logLines,
        })
      : {
          source: 'none' as const,
          excerpt: 'Job is not in failed state.',
        }

    const confidence: ExplainJobFailureHandlerOutput['confidence'] = !isFailed
      ? 'low'
      : topSignal.source === 'failed_reason' || topSignal.source === 'stacktrace'
        ? 'high'
        : topSignal.source === 'logs'
          ? 'medium'
          : 'low'

    const relatedAlertEvents = isFailed
      ? alertEvents.map((event) => toMcpAlertEventSummary(event))
      : []

    return {
      connectionId: connection.id,
      queueName: input.queueName,
      jobId: input.jobId,
      status,
      summary: buildSummary({
        queueName: input.queueName,
        jobId: input.jobId,
        status,
        failedReason,
        topSignal,
        alertCount: relatedAlertCount,
      }),
      failedReason,
      attemptTimeline: {
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts ?? 1,
        processedOn: job.processedOn ?? null,
        finishedOn: job.finishedOn ?? null,
        timestamp: job.timestamp ?? null,
      },
      topSignal,
      relatedAlertEvents,
      recentLogLines: isFailed ? logLines.slice(-EXPLAIN_LOG_LINE_COUNT) : [],
      confidence,
      sources: isFailed
        ? ['job.failedReason', 'job.stacktrace', 'queue.getJobLogs', 'alert_event']
        : ['job.state'],
    }
  }
}

export const explainJobFailureHandler = createExplainJobFailureHandler()
