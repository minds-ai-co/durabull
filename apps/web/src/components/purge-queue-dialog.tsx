import { trackEvent } from '@durabull/analytics/browser'
import { AnalyticsEvents, AnalyticsProperties, DialogType } from '@durabull/analytics/events'
import { Loader2, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  type PurgeQueueStatus,
  type PurgeQueueStatusOption,
  PURGE_QUEUE_STATUSES,
  usePurgeQueue,
} from '@/hooks/use-queues'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface QueueJobCounts {
  waiting: number
  active: number
  delayed: number
  completed: number
  failed: number
  paused: number
  prioritized: number
}

interface PurgeQueueDialogProps {
  queueName: string
  queueJobCounts?: QueueJobCounts
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MAX_KEEP_MOST_RECENT = 1_000_000
const KEEP_MOST_RECENT_PRESETS = [0, 10, 50, 100] as const

const STATUS_LABELS: Record<PurgeQueueStatus, string> = {
  waiting: 'Waiting',
  active: 'Active',
  delayed: 'Delayed',
  completed: 'Completed',
  failed: 'Failed',
  paused: 'Paused',
  prioritized: 'Prioritized',
}

function parseKeepMostRecent(rawValue: string): number | null {
  const value = rawValue.trim()

  if (value.length === 0 || !/^\d+$/.test(value)) {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed)) {
    return null
  }

  return parsed
}

function formatJobCount(count: number): string {
  return `${count.toLocaleString()} job${count === 1 ? '' : 's'}`
}

export function PurgeQueueDialog({
  queueName,
  queueJobCounts,
  open,
  onOpenChange,
}: PurgeQueueDialogProps) {
  const [confirmInput, setConfirmInput] = useState('')
  const [purgeAll, setPurgeAll] = useState(false)
  const [selectedStatuses, setSelectedStatuses] = useState<Set<PurgeQueueStatus>>(new Set())
  const [keepMostRecentInput, setKeepMostRecentInput] = useState('0')
  const purgeMutation = usePurgeQueue()

  useEffect(() => {
    if (!open) {
      setConfirmInput('')
      setPurgeAll(false)
      setSelectedStatuses(new Set())
      setKeepMostRecentInput('0')
    }
  }, [open])

  const jobCounts: QueueJobCounts = useMemo(
    () => ({
      waiting: queueJobCounts?.waiting ?? 0,
      active: queueJobCounts?.active ?? 0,
      delayed: queueJobCounts?.delayed ?? 0,
      completed: queueJobCounts?.completed ?? 0,
      failed: queueJobCounts?.failed ?? 0,
      paused: queueJobCounts?.paused ?? 0,
      prioritized: queueJobCounts?.prioritized ?? 0,
    }),
    [queueJobCounts]
  )

  const totalJobs = Object.values(jobCounts).reduce((sum, count) => sum + count, 0)
  const hasStatusSelection = purgeAll || selectedStatuses.size > 0
  const isConfirmed = confirmInput === queueName
  const isPurging = purgeMutation.isPending
  const parsedKeepMostRecent = useMemo(
    () => parseKeepMostRecent(keepMostRecentInput),
    [keepMostRecentInput]
  )
  const keepMostRecentError = useMemo(() => {
    if (parsedKeepMostRecent === null) {
      return 'Enter a whole number between 0 and 1,000,000.'
    }

    if (parsedKeepMostRecent > MAX_KEEP_MOST_RECENT) {
      return `Value must be ${MAX_KEEP_MOST_RECENT.toLocaleString()} or less.`
    }

    return null
  }, [parsedKeepMostRecent])
  const keepMostRecentValue = parsedKeepMostRecent ?? 0

  const selectedJobsEstimate = purgeAll
    ? totalJobs
    : Array.from(selectedStatuses).reduce((sum, status) => sum + jobCounts[status], 0)
  const estimatedRetainedJobs = hasStatusSelection
    ? Math.min(selectedJobsEstimate, keepMostRecentValue)
    : 0
  const estimatedPurgedJobs = hasStatusSelection
    ? Math.max(selectedJobsEstimate - keepMostRecentValue, 0)
    : 0
  const canSubmit =
    hasStatusSelection &&
    isConfirmed &&
    parsedKeepMostRecent !== null &&
    keepMostRecentError === null &&
    !isPurging

  const toggleStatus = (status: PurgeQueueStatus) => {
    if (purgeAll) return

    setSelectedStatuses((current) => {
      const next = new Set(current)
      if (next.has(status)) {
        next.delete(status)
      } else {
        next.add(status)
      }
      return next
    })
  }

  const handlePurge = async () => {
    if (!canSubmit) return

    const statuses: PurgeQueueStatusOption[] = purgeAll ? ['all'] : Array.from(selectedStatuses)
    const keepMostRecent = parsedKeepMostRecent ?? 0

    try {
      const result = await purgeMutation.mutateAsync({
        queueName,
        confirmName: confirmInput,
        statuses,
        keepMostRecent,
      })
      const keptMostRecent =
        typeof result.keptMostRecent === 'number'
          ? result.keptMostRecent
          : Math.min(keepMostRecent, selectedJobsEstimate)
      const removedDescription = `Removed ${formatJobCount(result.totalRemoved)}.`
      const retainedDescription =
        keepMostRecent > 0 ? ` Kept ${formatJobCount(keptMostRecent)}.` : ''

      toast.success('Queue purge completed', {
        description: `${removedDescription}${retainedDescription}`,
      })
      onOpenChange(false)
    } catch {
      // Errors are surfaced by shared API handlers.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        trackEvent(newOpen ? AnalyticsEvents.DIALOG_OPENED : AnalyticsEvents.DIALOG_CLOSED, {
          [AnalyticsProperties.DIALOG_TYPE]: DialogType.PURGE_QUEUE,
        })
        onOpenChange(newOpen)
      }}
    >
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Purge Queue Jobs</DialogTitle>
          <DialogDescription>
            Permanently remove jobs from selected statuses. Optionally retain the most recent N
            matching jobs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground mb-2">Queue:</p>
            <p className="font-mono font-semibold break-all">{queueName}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Total jobs detected:{' '}
              <span className="font-semibold">{totalJobs.toLocaleString()}</span>
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Select statuses to purge</Label>

            <label
              htmlFor="purge-all-jobs"
              className="flex items-center justify-between rounded-md border border-border/70 bg-background px-3 py-2 cursor-pointer transition-colors hover:bg-muted/40"
            >
              <span className="text-sm font-medium">All jobs</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{totalJobs.toLocaleString()}</span>
                <input
                  id="purge-all-jobs"
                  type="checkbox"
                  checked={purgeAll}
                  onChange={(e) => {
                    setPurgeAll(e.target.checked)
                    if (e.target.checked) {
                      setSelectedStatuses(new Set())
                    }
                  }}
                  className="rounded border-gray-300"
                />
              </div>
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              {PURGE_QUEUE_STATUSES.map((status) => (
                <label
                  key={status}
                  htmlFor={`purge-status-${status}`}
                  className={`flex items-center justify-between rounded-md border border-border/70 bg-background px-3 py-2 transition-colors ${
                    purgeAll ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <span className="text-sm">{STATUS_LABELS[status]}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {jobCounts[status].toLocaleString()}
                    </span>
                    <input
                      id={`purge-status-${status}`}
                      type="checkbox"
                      checked={selectedStatuses.has(status)}
                      onChange={() => toggleStatus(status)}
                      disabled={purgeAll}
                      className="rounded border-gray-300"
                    />
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
            <div className="space-y-1">
              <Label htmlFor="purge-queue-keep-most-recent-input" className="text-sm font-medium">
                Retain most recent N jobs
              </Label>
              <p className="text-xs text-muted-foreground">
                Use <span className="font-mono">0</span> to remove all matched jobs.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {KEEP_MOST_RECENT_PRESETS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={
                    keepMostRecentError === null && keepMostRecentValue === value
                      ? 'secondary'
                      : 'outline'
                  }
                  size="xs"
                  onClick={() => setKeepMostRecentInput(String(value))}
                >
                  {value === 0 ? 'Keep 0' : `Keep ${value.toLocaleString()}`}
                </Button>
              ))}
            </div>

            <Input
              id="purge-queue-keep-most-recent-input"
              data-testid="purge-queue-keep-most-recent-input"
              value={keepMostRecentInput}
              onChange={(event) => setKeepMostRecentInput(event.target.value)}
              inputMode="numeric"
              placeholder="0"
              min={0}
              max={MAX_KEEP_MOST_RECENT}
              className={
                keepMostRecentError
                  ? 'border-destructive focus-visible:ring-destructive'
                  : undefined
              }
            />

            {keepMostRecentError ? (
              <p className="text-sm text-destructive">{keepMostRecentError}</p>
            ) : hasStatusSelection ? (
              <p className="text-xs text-muted-foreground">
                Estimated outcome: purge {formatJobCount(estimatedPurgedJobs)} and retain{' '}
                {formatJobCount(estimatedRetainedJobs)}.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Select statuses to preview what will be purged.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="purge-queue-confirm-input"
              className="flex flex-wrap items-center gap-1.5 leading-normal"
            >
              <span>Type</span>
              <span className="inline-flex max-w-full items-center rounded bg-muted px-1.5 py-0.5 font-mono font-semibold break-all">
                {queueName}
              </span>
              <span>to confirm purge</span>
            </Label>
            <Input
              id="purge-queue-confirm-input"
              data-testid="purge-queue-confirm-input"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={
                hasStatusSelection ? 'Enter queue name to confirm' : 'Select statuses first'
              }
              disabled={!hasStatusSelection}
              className={
                confirmInput && !isConfirmed
                  ? 'border-destructive focus-visible:ring-destructive'
                  : ''
              }
              autoComplete="off"
            />
            {!hasStatusSelection && (
              <p className="text-xs text-muted-foreground">
                Select one or more statuses (or All jobs) to enable confirmation.
              </p>
            )}
            {hasStatusSelection && keepMostRecentError === null && selectedJobsEstimate > 0 && (
              <p className="text-xs text-muted-foreground">
                Matching jobs before retention: {selectedJobsEstimate.toLocaleString()}
              </p>
            )}
            {confirmInput && !isConfirmed && (
              <p className="text-sm text-destructive">Queue name does not match.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPurging}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handlePurge}
            disabled={!canSubmit}
            data-testid="purge-queue-confirm-button"
          >
            {isPurging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Purging...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Purge Jobs
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
