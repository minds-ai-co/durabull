import type { ListWorkersResponse } from '@/hooks/use-queues'

export const UNASSIGNED_COMPONENT_NAME = 'unassigned'

export type ProcessorComponentDefinition = ListWorkersResponse['processorComponents'][number]

export interface ProcessorWorkloadTopology {
  name: string
  observedJobs: number
  queueNames: string[]
  workerCount: number
  configured: boolean
}

export interface ProcessorComponentTopology extends ProcessorComponentDefinition {
  observedWorkloads: number
  workloads: ProcessorWorkloadTopology[]
}

export function processorComponentOwner(
  components: ProcessorComponentDefinition[],
  processorName: string,
  queueName: string
): string {
  return (
    components.find((component) => component.processors.includes(processorName))?.name ??
    components.find((component) => component.processors.includes(queueName))?.name ??
    UNASSIGNED_COMPONENT_NAME
  )
}

export function buildProcessorComponentTopology(
  data: ListWorkersResponse
): ProcessorComponentTopology[] {
  const configuredProcessorNames = new Set(
    data.processorComponents.flatMap((component) => component.processors)
  )

  const configured = data.processorComponents.map((component) => {
    const workloads = component.processors.map((processorName) => {
      const matchingQueues = data.queues.filter(
        (queue) =>
          queue.name === processorName ||
          queue.processorObservation.processors.some(
            (processor) => processor.name === processorName
          )
      )
      const queueNames = matchingQueues.map((queue) => queue.name).sort()
      const observedJobs = matchingQueues.reduce((total, queue) => {
        if (queue.name === processorName) return total + queue.processorObservation.sampledJobs
        return (
          total +
          queue.processorObservation.processors
            .filter((processor) => processor.name === processorName)
            .reduce((sum, processor) => sum + processor.observedJobs, 0)
        )
      }, 0)
      const workerCount = data.workers.filter(
        (worker) => worker.queueName === processorName || worker.name === processorName
      ).length

      return {
        name: processorName,
        observedJobs,
        queueNames,
        workerCount,
        configured: true,
      }
    })

    return {
      ...component,
      observedWorkloads: workloads.filter(
        (workload) => workload.observedJobs > 0 || workload.workerCount > 0
      ).length,
      workloads,
    }
  })

  const unassignedByName = new Map<string, ProcessorWorkloadTopology>()
  for (const queue of data.queues) {
    const queueConfigured = configuredProcessorNames.has(queue.name)
    for (const processor of queue.processorObservation.processors) {
      if (queueConfigured || configuredProcessorNames.has(processor.name)) continue
      const existing = unassignedByName.get(processor.name)
      if (existing) {
        existing.observedJobs += processor.observedJobs
        if (!existing.queueNames.includes(queue.name)) existing.queueNames.push(queue.name)
      } else {
        unassignedByName.set(processor.name, {
          name: processor.name,
          observedJobs: processor.observedJobs,
          queueNames: [queue.name],
          workerCount: 0,
          configured: false,
        })
      }
    }
  }

  for (const worker of data.workers) {
    if (
      configuredProcessorNames.has(worker.queueName) ||
      configuredProcessorNames.has(worker.name)
    ) {
      continue
    }
    const name = worker.name || worker.queueName
    const existing = unassignedByName.get(name)
    if (existing) {
      existing.workerCount += 1
      if (!existing.queueNames.includes(worker.queueName))
        existing.queueNames.push(worker.queueName)
    } else {
      unassignedByName.set(name, {
        name,
        observedJobs: 0,
        queueNames: [worker.queueName],
        workerCount: 1,
        configured: false,
      })
    }
  }

  const unassignedWorkloads = [...unassignedByName.values()]
    .map((workload) => ({ ...workload, queueNames: workload.queueNames.sort() }))
    .sort((left, right) => left.name.localeCompare(right.name))

  if (unassignedWorkloads.length === 0) return configured

  return [
    ...configured,
    {
      name: UNASSIGNED_COMPONENT_NAME,
      label: 'Unassigned',
      description: 'Observed workloads not present in the deployment component configuration.',
      processors: unassignedWorkloads.map((workload) => workload.name),
      observedWorkloads: unassignedWorkloads.length,
      workloads: unassignedWorkloads,
    },
  ]
}
