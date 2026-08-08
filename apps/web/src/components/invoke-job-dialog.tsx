import { Loader2, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { trackEvent } from '@durabull/analytics/browser'
import { AnalyticsEvents, AnalyticsProperties, DialogType } from '@durabull/analytics/events'
import { JsonEditor } from '@/components/json-editor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useInvokeJobs } from '@/hooks/use-queues'

interface InvokeJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  queueName: string
  jobId: string
  jobName: string
  jobData: Record<string, unknown>
  onSuccess?: () => void
}

export function InvokeJobDialog({
  open,
  onOpenChange,
  queueName,
  jobId,
  jobName,
  jobData: originalJobData,
  onSuccess,
}: InvokeJobDialogProps) {
  const [jobData, setJobData] = useState<unknown>(originalJobData)
  const [isJsonValid, setIsJsonValid] = useState(true)

  const invokeMutation = useInvokeJobs()

  // Reset form when dialog opens with new job
  useEffect(() => {
    if (open) {
      setJobData(originalJobData)
      setIsJsonValid(true)
    }
  }, [open, originalJobData])

  const handleJsonChange = (value: unknown, isValid: boolean) => {
    setJobData(value)
    setIsJsonValid(isValid)
  }

  const handleSubmit = async () => {
    if (!isJsonValid) return

    try {
      await invokeMutation.mutateAsync({
        queueName,
        jobIds: [jobId],
        jobData: jobData as Record<string, unknown>,
      })

      toast.success('Job invoked successfully', {
        description: 'The job will now run immediately.',
      })

      onOpenChange(false)
      onSuccess?.()
    } catch {
      // Error is handled by react-query
    }
  }

  const isSubmitting = invokeMutation.isPending
  const canSubmit = isJsonValid && !isSubmitting

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        trackEvent(newOpen ? AnalyticsEvents.DIALOG_OPENED : AnalyticsEvents.DIALOG_CLOSED, {
          [AnalyticsProperties.DIALOG_TYPE]: DialogType.INVOKE_JOB,
        })
        onOpenChange(newOpen)
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Invoke Job
          </DialogTitle>
          <DialogDescription>
            Run this delayed job immediately. You can optionally modify the job payload before
            invoking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Job Info (read-only reference) */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Job ID:</p>
              <p className="font-mono text-sm break-all">{jobId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Job Name:</p>
              <p className="text-sm font-medium">{jobName}</p>
            </div>
          </div>

          {/* Job Data */}
          <div className="space-y-2">
            <Label>Job Payload (JSON)</Label>
            <p className="text-xs text-muted-foreground">
              Edit the payload data that will be passed to the job when it runs.
            </p>
            <JsonEditor value={jobData} onChange={handleJsonChange} minHeight="200px" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Invoking...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Invoke Now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
