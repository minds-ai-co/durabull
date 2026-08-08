export interface ProcessorGroup<T> {
  name: string
  jobs: T[]
}

export function groupJobsByProcessor<T extends { name: string }>(jobs: T[]): ProcessorGroup<T>[] {
  const groups = new Map<string, T[]>()

  for (const job of jobs) {
    const processorName = job.name.trim() || 'Unnamed processor'
    const processorJobs = groups.get(processorName)

    if (processorJobs) {
      processorJobs.push(job)
    } else {
      groups.set(processorName, [job])
    }
  }

  return Array.from(groups, ([name, processorJobs]) => ({ name, jobs: processorJobs })).sort(
    (a, b) => a.name.localeCompare(b.name)
  )
}
