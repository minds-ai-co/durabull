import { getQueue } from '../../lib/redis'
import { toRedisConnectionOptions } from '../../lib/connection-options'
import type { ListJobsHandlerInput, ListJobsHandlerOutput } from '@durabull/mcp'
import {
  McpToolError,
  decodeCursor,
  encodeCursor,
  requireConnectionForPrincipal,
} from './shared'

type JobState =
  | 'waiting'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'paused'
  | 'prioritized'

const ALL_STATES: JobState[] = [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
  'prioritized',
]

const FILTER_SCAN_BATCH_SIZE = 200
const MAX_FILTER_SCAN_JOBS = 10_000

export async function listJobsHandler(input: ListJobsHandlerInput): Promise<ListJobsHandlerOutput> {
  const connection = await requireConnectionForPrincipal(input.principal, input.connectionId)

  const queue = await getQueue(
    connection.id,
    connection.url,
    input.queueName,
    connection.prefix,
    toRedisConnectionOptions(connection.allowSelfSignedCerts)
  )

  if (input.jobId) {
    const exactJob = await queue.getJob(input.jobId)
    if (!exactJob) {
      return {
        connectionId: connection.id,
        queueName: input.queueName,
        jobs: [],
        total: 0,
        nextCursor: null,
      }
    }
    const exactState = await exactJob.getState()
    if (input.status && exactState !== input.status) {
      return {
        connectionId: connection.id,
        queueName: input.queueName,
        jobs: [],
        total: 0,
        nextCursor: null,
      }
    }
    if (input.name && !exactJob.name.toLowerCase().includes(input.name.toLowerCase())) {
      return {
        connectionId: connection.id,
        queueName: input.queueName,
        jobs: [],
        total: 0,
        nextCursor: null,
      }
    }
    return {
      connectionId: connection.id,
      queueName: input.queueName,
      jobs: [
        {
          id: String(exactJob.id ?? ''),
          name: exactJob.name,
          status: exactState,
          attemptsMade: exactJob.attemptsMade,
          maxAttempts: exactJob.opts.attempts ?? 1,
          failedReason: exactJob.failedReason ?? null,
          processedOn: exactJob.processedOn ?? null,
          finishedOn: exactJob.finishedOn ?? null,
          timestamp: exactJob.timestamp ?? null,
          delay: exactJob.delay ?? 0,
          priority: exactJob.opts.priority ?? 0,
        },
      ],
      total: 1,
      nextCursor: null,
    }
  }

  const states: JobState[] = input.status ? [input.status as JobState] : [...ALL_STATES]
  const hasClientFilter = Boolean(input.name || input.jobId)
  const pageSize = Math.min(100, Math.max(1, input.pageSize))
  const offset = decodeCursor(input.cursor)

  if (hasClientFilter) {
    let scannedJobs = 0
    const jobsWithState: Array<{
      job: NonNullable<Awaited<ReturnType<typeof queue.getJobs>>[number]>
      state: JobState
    }> = []
    for (const state of states) {
      for (let start = 0; ; start += FILTER_SCAN_BATCH_SIZE) {
        const end = start + FILTER_SCAN_BATCH_SIZE - 1
        const stateJobs = await queue.getJobs([state], start, end)
        if (stateJobs.length === 0) {
          break
        }

        for (const job of stateJobs) {
          if (job == null) continue

          scannedJobs += 1
          if (scannedJobs > MAX_FILTER_SCAN_JOBS) {
            throw new McpToolError(
              'validation_error',
              `Filtered job search exceeded ${MAX_FILTER_SCAN_JOBS} jobs. Narrow the query with status or jobId.`
            )
          }

          jobsWithState.push({ job, state })
        }
      }
    }
    const filtered = jobsWithState
      .filter(({ job }) =>
        input.name ? job.name.toLowerCase().includes(input.name.toLowerCase()) : true
      )
      .map(({ job, state }) => ({
        id: String(job.id ?? ''),
        name: job.name,
        status: state,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts ?? 1,
        failedReason: job.failedReason ?? null,
        processedOn: job.processedOn ?? null,
        finishedOn: job.finishedOn ?? null,
        timestamp: job.timestamp ?? null,
        delay: job.delay ?? 0,
        priority: job.opts.priority ?? 0,
      }))

    const page = filtered.slice(offset, offset + pageSize)
    const nextOffset = offset + pageSize
    return {
      connectionId: connection.id,
      queueName: input.queueName,
      jobs: page,
      total: filtered.length,
      nextCursor: nextOffset < filtered.length ? encodeCursor(nextOffset) : null,
    }
  }

  const end = offset + pageSize - 1

  const jobs = await queue.getJobs(states, offset, end)
  const mappedJobs = await Promise.all(
    jobs
      .filter((job): job is NonNullable<typeof job> => job != null)
      .map(async (job) => ({
        id: String(job.id ?? ''),
        name: job.name,
        status: await job.getState(),
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts ?? 1,
        failedReason: job.failedReason ?? null,
        processedOn: job.processedOn ?? null,
        finishedOn: job.finishedOn ?? null,
        timestamp: job.timestamp ?? null,
        delay: job.delay ?? 0,
        priority: job.opts.priority ?? 0,
      }))
  )

  const total = await queue.getJobCountByTypes(...states)
  const nextOffset = offset + pageSize
  return {
    connectionId: connection.id,
    queueName: input.queueName,
    jobs: mappedJobs,
    total,
    nextCursor: nextOffset < total ? encodeCursor(nextOffset) : null,
  }
}
