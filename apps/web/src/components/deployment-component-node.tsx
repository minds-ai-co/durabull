import { Handle, type NodeProps, Position } from '@xyflow/react'
import { Container, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const componentAccents = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#71717a']

export function DeploymentComponentNode({ data }: NodeProps) {
  const name = data.name as string
  const label = data.label as string
  const description = data.description as string
  const workloadCount = data.workloadCount as number
  const observedWorkloads = data.observedWorkloads as number
  const accent = componentAccents[(data.accentIndex as number) % componentAccents.length]

  return (
    <div
      className="relative w-[300px] overflow-hidden rounded-xl border bg-card shadow-xl"
      style={{ borderColor: `${accent}66` }}
      data-testid={`topology-component-${name}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2"
        style={{ backgroundColor: accent, borderColor: accent }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2"
        style={{ backgroundColor: accent, borderColor: accent }}
      />
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: accent }} />
      <div className="px-5 py-4 pl-6">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${accent}1f`, color: accent }}
          >
            <Container className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">{label}</div>
            <code className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
              {name}
            </code>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{description}</p>
        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <Badge variant="outline" className="font-mono text-[10px] font-normal">
            {workloadCount} workloads
          </Badge>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Eye className="h-3 w-3" aria-hidden="true" />
            {observedWorkloads} observed
          </span>
        </div>
      </div>
    </div>
  )
}
