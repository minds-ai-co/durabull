import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { Boxes, Server } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function ProcessorTopologyNode({ data }: NodeProps) {
  const name = data.label as string
  const observedJobs = data.observedJobs as number
  const workerCount = (data.workerCount as number | undefined) ?? 0
  const configured = (data.configured as boolean | undefined) ?? false
  const observed = observedJobs > 0 || workerCount > 0
  const queueNames = (data.queueNames as string[] | undefined) ?? []

  return (
    <div
      className={cn(
        'relative min-w-[240px] rounded-lg border bg-card px-4 py-3 shadow-lg',
        observed ? 'border-primary/35 ring-1 ring-primary/10' : 'border-dashed border-border'
      )}
      data-testid={`topology-processor-${name}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={cn(
          '!h-2.5 !w-2.5 !border-2',
          observed ? '!border-primary !bg-primary' : '!border-muted-foreground !bg-muted'
        )}
      />
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            observed ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}
        >
          <Boxes className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm font-medium text-foreground" title={name}>
            {name}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px] font-normal">
              {observed ? 'Observed' : configured ? 'Configured' : 'Unassigned'}
            </Badge>
            {observedJobs > 0 ? (
              <span className="text-[11px] text-muted-foreground">
                {observedJobs} sampled job{observedJobs === 1 ? '' : 's'}
              </span>
            ) : null}
            {workerCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Server className="h-3 w-3" aria-hidden="true" />
                {workerCount}
              </span>
            ) : null}
          </div>
          {queueNames.length > 0 ? (
            <div
              className="mt-1 max-w-[190px] truncate font-mono text-[10px] text-muted-foreground"
              title={queueNames.join(', ')}
            >
              {queueNames.join(', ')}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
