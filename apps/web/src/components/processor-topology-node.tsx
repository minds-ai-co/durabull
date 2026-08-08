import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { Boxes } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function ProcessorTopologyNode({ data }: NodeProps) {
  const name = data.label as string
  const observedJobs = data.observedJobs as number

  return (
    <div
      className="relative min-w-[220px] rounded-lg border border-primary/35 bg-card px-4 py-3 shadow-lg ring-1 ring-primary/10"
      data-testid={`topology-processor-${name}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-primary !bg-primary"
      />
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Boxes className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm font-medium text-foreground" title={name}>
            {name}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px] font-normal">
              Processor
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {observedJobs} observed job{observedJobs === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
