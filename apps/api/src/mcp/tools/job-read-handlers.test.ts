import { describe, expect, it } from 'bun:test'

import { createGetJobHandler } from './get-job-handler'
import { createGetJobLogsHandler } from './get-job-logs-handler'
import { createGetJobStacktracesHandler } from './get-job-stacktraces-handler'
import { McpToolError } from './shared'

const principal = {
  type: 'service_account' as const,
  principalId: 'principal-1',
  organizationId: 'org-1',
}

const connection = {
  id: 'conn-1',
  url: 'redis://localhost:6379',
  prefix: 'bull',
  allowSelfSignedCerts: false,
}

describe('MCP job read handlers', () => {
  it('returns full payload for get_job', async () => {
    const getJobHandler = createGetJobHandler({
      async requireConnectionForPrincipal() {
        return connection as never
      },
      async getQueue() {
        return {
          async getJob() {
            return {
              id: 'job-1',
              name: 'send-email',
              data: { hello: 'world' },
              progress: 50,
              attemptsMade: 1,
              opts: { attempts: 3, priority: 2 },
              failedReason: null,
              processedOn: 10,
              finishedOn: 20,
              timestamp: 1,
              delay: 0,
              returnvalue: { ok: true },
              stacktrace: ['trace-line'],
              async getState() {
                return 'active'
              },
            }
          },
        } as never
      },
    })

    const result = await getJobHandler({
      principal,
      connectionId: 'conn-1',
      queueName: 'email',
      jobId: 'job-1',
    })

    expect(result.job.id).toBe('job-1')
    expect(result.job.status).toBe('active')
    expect(result.job.stacktraceCount).toBe(1)
    expect(result.job.data).toEqual({ hello: 'world' })
  })

  it('returns paginated logs for get_job_logs', async () => {
    const getJobLogsHandler = createGetJobLogsHandler({
      async requireConnectionForPrincipal() {
        return connection as never
      },
      async getQueue() {
        return {
          async getJob() {
            return { id: 'job-1' }
          },
          async getJobLogs() {
            return { logs: ['line-1', 'line-2'], count: 3 }
          },
        } as never
      },
    })

    const result = await getJobLogsHandler({
      principal,
      connectionId: 'conn-1',
      queueName: 'email',
      jobId: 'job-1',
      pageSize: 2,
      cursor: '0',
    })

    expect(result.logs).toEqual(['line-1', 'line-2'])
    expect(result.total).toBe(3)
    expect(result.nextCursor).toBe('2')
  })

  it('returns latest-first stacktraces for get_job_stacktraces', async () => {
    const getJobStacktracesHandler = createGetJobStacktracesHandler({
      async requireConnectionForPrincipal() {
        return connection as never
      },
      async getQueue() {
        return {
          async getJob() {
            return {
              id: 'job-1',
              stacktrace: ['first', 'second', 'third'],
            }
          },
        } as never
      },
    })

    const result = await getJobStacktracesHandler({
      principal,
      connectionId: 'conn-1',
      queueName: 'email',
      jobId: 'job-1',
      pageSize: 2,
      cursor: '0',
    })

    expect(result.total).toBe(3)
    expect(result.stacktraces.map((row) => row.stacktrace)).toEqual(['third', 'second'])
    expect(result.stacktraces[0]?.isLatest).toBe(true)
    expect(result.nextCursor).toBe('2')
  })

  it('throws typed not_found when job is missing', async () => {
    const getJobHandler = createGetJobHandler({
      async requireConnectionForPrincipal() {
        return connection as never
      },
      async getQueue() {
        return {
          async getJob() {
            return null
          },
        } as never
      },
    })

    await expect(
      getJobHandler({
        principal,
        connectionId: 'conn-1',
        queueName: 'email',
        jobId: 'missing',
      })
    ).rejects.toBeInstanceOf(McpToolError)
  })
})
