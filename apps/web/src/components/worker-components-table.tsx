import { Boxes, Search, Server } from 'lucide-react'
import { useMemo, useState } from 'react'
import { QueueNameTag } from '@/components/queue-name-tag'
import { StatusIndicator } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ListWorkersResponse } from '@/hooks/use-queues'
import { cn, formatDuration } from '@/lib/utils'

type ComponentType = 'processor' | 'worker'

type ComponentRow =
  | {
      key: string
      type: 'processor'
      name: string
      queueName: string
      observedJobs: number
    }
  | {
      key: string
      type: 'worker'
      name: string
      queueName: string
      address: string
      age: number
      idle: number
      active: boolean
    }

function buildComponentRows(data: ListWorkersResponse): ComponentRow[] {
  const processorRows: ComponentRow[] = data.queues.flatMap((queue) =>
    queue.processorObservation.processors.map((processor) => ({
      key: `processor-${queue.name}-${processor.name}`,
      type: 'processor' as const,
      name: processor.name,
      queueName: queue.name,
      observedJobs: processor.observedJobs,
    }))
  )
  const workerRows: ComponentRow[] = data.workers.map((worker) => ({
    key: `worker-${worker.queueName}-${worker.id}`,
    type: 'worker' as const,
    name: worker.name || worker.id,
    queueName: worker.queueName,
    address: worker.addr,
    age: worker.age,
    idle: worker.idle,
    active: worker.idle <= 5000,
  }))

  return [...processorRows, ...workerRows].sort((left, right) => {
    const queueComparison = left.queueName.localeCompare(right.queueName)
    if (queueComparison !== 0) return queueComparison
    const typeComparison = left.type.localeCompare(right.type)
    if (typeComparison !== 0) return typeComparison
    return left.name.localeCompare(right.name)
  })
}

export function WorkerComponentsTable({ data }: { data: ListWorkersResponse }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ComponentType | 'all'>('all')
  const rows = useMemo(() => buildComponentRows(data), [data])
  const normalizedSearch = search.trim().toLowerCase()
  const visibleRows = rows.filter((row) => {
    if (typeFilter !== 'all' && row.type !== typeFilter) return false
    if (!normalizedSearch) return true
    const runtime = row.type === 'worker' ? row.address : ''
    return `${row.name} ${row.queueName} ${runtime}`.toLowerCase().includes(normalizedSearch)
  })
  const processorCount = rows.filter((row) => row.type === 'processor').length
  const workerCount = rows.length - processorCount
  const processorObservationIncomplete = data.queues.some(
    (queue) => !queue.processorObservation.available || queue.processorObservation.truncated
  )

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base font-medium">
              <Boxes className="h-4 w-4 text-muted-foreground" />
              Component Overview
              <Badge variant="outline" className="font-mono font-normal tabular-nums">
                {processorCount} processors · {workerCount} workers
              </Badge>
              {processorObservationIncomplete ? (
                <Badge variant="warning" className="font-normal">
                  Processor sample incomplete
                </Badge>
              ) : null}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Observed processors and connected workers across {data.queues.length} loaded queues.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="relative min-w-56 flex-1 sm:flex-none">
              <span className="sr-only">Search components</span>
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search component or queue"
                className="h-8 pl-8 text-xs"
              />
            </label>
            <Select
              aria-label="Component type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as ComponentType | 'all')}
              className="h-8 min-w-36 text-xs"
            >
              <option value="all">All components</option>
              <option value="processor">Processors</option>
              <option value="worker">Workers</option>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[640px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead>Activity evidence</TableHead>
                <TableHead>Runtime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
                    {rows.length === 0
                      ? 'No processor or worker components were found.'
                      : 'No components match these filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((row) => (
                  <TableRow
                    key={row.key}
                    data-testid={`component-row-${row.type}-${row.queueName}-${row.name}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'h-6 w-1 rounded-full',
                            row.type === 'processor' ? 'bg-primary/70' : 'bg-status-success'
                          )}
                          aria-hidden="true"
                        />
                        <Badge
                          variant="outline"
                          className="gap-1.5 font-mono text-[10px] font-normal uppercase tracking-wide"
                        >
                          {row.type === 'processor' ? (
                            <Boxes className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <Server className="h-3 w-3" aria-hidden="true" />
                          )}
                          {row.type}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.type === 'processor' ? (
                        <span className="inline-flex items-center gap-2 text-xs font-medium text-primary">
                          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                          Observed
                        </span>
                      ) : (
                        <StatusIndicator
                          status={row.active ? 'active' : 'idle'}
                          showPulse={false}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-xs font-medium text-foreground">
                        {row.name}
                      </code>
                    </TableCell>
                    <TableCell>
                      <QueueNameTag name={row.queueName} asLink size="sm" />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.type === 'processor' ? (
                        <span className="font-mono tabular-nums">
                          {row.observedJobs} sampled job{row.observedJobs === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span>
                          Age {formatDuration(row.age * 1000)} · Idle {formatDuration(row.idle)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.type === 'worker' ? (
                        <code className="font-mono text-xs text-muted-foreground">
                          {row.address}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground">BullMQ job name</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="border-t bg-muted/20 px-4 py-2 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
          Showing {visibleRows.length} of {rows.length} components
        </div>
      </CardContent>
    </Card>
  )
}
