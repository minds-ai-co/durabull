import { trackEvent } from '@durabull/analytics/browser'
import { AnalyticsEvents, AnalyticsProperties, DialogType } from '@durabull/analytics/events'
import { Copy, Loader2, Play } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { JsonEditor } from '@/components/json-editor'
import { JobOptionsFields } from '@/components/job-options-fields'
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
import { useAddJob } from '@/hooks/use-queues'
import {
  formValueToJobOptions,
  hasJobOptionsValidationErrors,
  jobOptsToFormValue,
  validateJobOptionsFormValue,
  type JobOptionsFormValue,
} from '@/lib/job-options'

interface DuplicateJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  queueName: string
  originalJobId: string
  originalJobName: string
  originalJobData: Record<string, unknown>
  originalJobOpts?: Record<string, unknown>
  originalDelay?: number
  onSuccess?: (newJobId: string) => void
}

export function DuplicateJobDialog({
  open,
  onOpenChange,
  queueName,
  originalJobId,
  originalJobName,
  originalJobData,
  originalJobOpts,
  originalDelay = 0,
  onSuccess,
}: DuplicateJobDialogProps) {
  const [jobName, setJobName] = useState(originalJobName)
  const [jobData, setJobData] = useState<unknown>(originalJobData)
  const [isJsonValid, setIsJsonValid] = useState(true)
  const [jobOptions, setJobOptions] = useState<JobOptionsFormValue>(() =>
    jobOptsToFormValue(originalJobOpts, originalDelay)
  )

  const addJobMutation = useAddJob()
  const jobOptionsErrors = useMemo(
    () => validateJobOptionsFormValue(jobOptions, { includeDelay: true }),
    [jobOptions]
  )

  useEffect(() => {
    if (open) {
      setJobName(originalJobName)
      setJobData(originalJobData)
      setIsJsonValid(true)
      setJobOptions(jobOptsToFormValue(originalJobOpts, originalDelay))
    }
  }, [open, originalJobName, originalJobData, originalJobOpts, originalDelay])

  const handleJsonChange = (value: unknown, isValid: boolean) => {
    setJobData(value)
    setIsJsonValid(isValid)
  }

  const handleSubmit = async () => {
    if (!isJsonValid || !jobName.trim() || hasJobOptionsValidationErrors(jobOptionsErrors)) {
      return
    }

    try {
      const result = await addJobMutation.mutateAsync({
        queueName,
        name: jobName.trim(),
        jobData,
        options: formValueToJobOptions(jobOptions),
      })

      toast.success('Job created successfully', {
        description: `Job ID: ${result.jobId}`,
      })

      onOpenChange(false)
      if (result.jobId && onSuccess) {
        onSuccess(result.jobId)
      }
    } catch {
      // Error is handled by react-query
    }
  }

  const isSubmitting = addJobMutation.isPending
  const canSubmit =
    isJsonValid &&
    jobName.trim() &&
    !isSubmitting &&
    !hasJobOptionsValidationErrors(jobOptionsErrors)

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        trackEvent(newOpen ? AnalyticsEvents.DIALOG_OPENED : AnalyticsEvents.DIALOG_CLOSED, {
          [AnalyticsProperties.DIALOG_TYPE]: DialogType.DUPLICATE_JOB,
        })
        onOpenChange(newOpen)
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplicate Job
          </DialogTitle>
          <DialogDescription>
            Create a new job based on the original. You can modify the data and options before
            adding it to the queue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Duplicating from job:</p>
            <p className="font-mono text-sm break-all">{originalJobId}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-name">Job Name</Label>
            <Input
              id="job-name"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="Enter job name"
            />
          </div>

          <div className="space-y-2">
            <Label>Job Data (JSON)</Label>
            <JsonEditor value={jobData} onChange={handleJsonChange} minHeight="180px" />
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-medium">Options</Label>
            <JobOptionsFields
              value={jobOptions}
              onChange={setJobOptions}
              errors={jobOptionsErrors}
              showDelay
              compact
              idPrefix="duplicate-job"
            />
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
                Adding...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Add Job
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
