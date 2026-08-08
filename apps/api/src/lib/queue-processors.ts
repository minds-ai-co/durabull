import type { Queue } from 'bullmq'

export const PROCESSOR_JOB_STATES = [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
  'prioritized',
] as const

export const PROCESSOR_SAMPLE_SIZE = 250

export interface ObservedProcessor {
  name: string
  observedJobs: number
}

export interface ProcessorObservation {
  processors: ObservedProcessor[]
  sampledJobs: number
  totalJobs: number
  truncated: boolean
  available: boolean
}

export function summarizeObservedProcessors(
  jobs: Array<{ name: string }>,
  totalJobs: number
): ProcessorObservation {
  const counts = new Map<string, number>()

  for (const job of jobs) {
    const name = job.name.trim() || 'Unnamed processor'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  const processors = Array.from(counts, ([name, observedJobs]) => ({ name, observedJobs })).sort(
    (left, right) => left.name.localeCompare(right.name)
  )

  return {
    processors,
    sampledJobs: jobs.length,
    totalJobs,
    truncated: totalJobs > jobs.length,
    available: true,
  }
}

export async function observeQueueProcessors(
  queue: Queue,
  totalJobs: number
): Promise<ProcessorObservation> {
  try {
    const jobs = (
      await queue.getJobs([...PROCESSOR_JOB_STATES], 0, PROCESSOR_SAMPLE_SIZE - 1, false)
    ).filter((job): job is NonNullable<typeof job> => job != null)

    return summarizeObservedProcessors(jobs, totalJobs)
  } catch {
    return {
      processors: [],
      sampledJobs: 0,
      totalJobs,
      truncated: totalJobs > 0,
      available: false,
    }
  }
}
