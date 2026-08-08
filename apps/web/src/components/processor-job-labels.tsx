import { Boxes } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'

export function ProcessorGroupRow({ name, loadedCount }: { name: string; loadedCount: number }) {
  return (
    <TableRow
      className="border-0 bg-muted/50 hover:bg-muted/50"
      data-testid={`processor-group-${name}`}
    >
      <TableCell colSpan={7} className="border-y border-border/70 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-5 w-1 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
          <Boxes className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate font-mono text-xs font-semibold text-foreground">{name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{loadedCount} loaded</span>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function ProcessorBadge({ name }: { name: string }) {
  const displayName = name.trim() || 'Unnamed processor'

  return (
    <Badge
      variant="outline"
      className="max-w-56 border-border/70 bg-background/70 font-mono font-normal"
      title={displayName}
    >
      <Boxes className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{displayName}</span>
    </Badge>
  )
}
