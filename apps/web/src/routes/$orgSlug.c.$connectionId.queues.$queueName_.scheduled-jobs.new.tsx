import { trackEvent } from '@durabull/analytics/browser'
import { AnalyticsEvents } from '@durabull/analytics/events'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ChevronRight, Layers } from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { useAppTopBar } from '@/components/app-top-bar'
import { ScheduledJobForm } from '@/components/scheduled-job-form'
import { Button } from '@/components/ui/button'
import { useCreateScheduledJob, useQueueScheduledJobs } from '@/hooks/use-queues'
import { ApiError } from '@/lib/api'

export const Route = createFileRoute(
  '/$orgSlug/c/$connectionId/queues/$queueName_/scheduled-jobs/new'
)({
  component: NewScheduledJobPage,
})

function NewScheduledJobPage() {
  const { orgSlug, connectionId, queueName } = Route.useParams()
  const navigate = useNavigate()
  const { data: scheduledJobs } = useQueueScheduledJobs(queueName)
  const createScheduledJobMutation = useCreateScheduledJob()

  useEffect(() => {
    trackEvent(AnalyticsEvents.SCHEDULED_JOB_CREATED, {
      queue_name: queueName,
      action: 'page_viewed',
    })
  }, [queueName])

  const handleBack = useCallback(() => {
    navigate({
      to: '/$orgSlug/c/$connectionId/queues/$queueName',
      params: { orgSlug, connectionId, queueName },
      search: {
        section: 'jobs',
        tab: 'scheduled',
        status: '',
        jobId: '',
        hideScheduled: 0,
        page: 1,
      },
    })
  }, [connectionId, navigate, orgSlug, queueName])

  const topBarConfig = useMemo(
    () => ({
      left: (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground">
            <Layers className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex items-center gap-1.5">
            <Link
              to="/$orgSlug/c/$connectionId"
              params={{ orgSlug, connectionId }}
              className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Queues
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            <Link
              to="/$orgSlug/c/$connectionId/queues/$queueName"
              params={{ orgSlug, connectionId, queueName }}
              search={{
                section: 'jobs',
                tab: 'scheduled',
                status: '',
                jobId: '',
                hideScheduled: 0,
                page: 1,
              }}
              className="max-w-40 truncate text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {queueName}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            <h1 className="truncate text-base font-semibold md:text-lg">Add Scheduled Job</h1>
          </div>
        </div>
      ),
      actions: (
        <Button variant="outline" size="xs" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Queue
        </Button>
      ),
    }),
    [connectionId, handleBack, orgSlug, queueName]
  )

  useAppTopBar(topBarConfig)

  return (
    <ScheduledJobForm
      mode="create"
      queueName={queueName}
      existingSchedulerIds={scheduledJobs?.scheduledJobs.map((job) => job.schedulerId) ?? []}
      isSubmitting={createScheduledJobMutation.isPending}
      onCancel={handleBack}
      onSubmit={async (payload) => {
        try {
          const result = await createScheduledJobMutation.mutateAsync({
            queueName,
            ...payload,
          })

          toast.success('Scheduled job created', {
            description: `Scheduler ID: ${result.scheduler.schedulerId}`,
          })

          navigate({
            to: '/$orgSlug/c/$connectionId/queues/$queueName/scheduled-jobs/$schedulerId',
            params: {
              orgSlug,
              connectionId,
              queueName,
              schedulerId: result.scheduler.schedulerId,
            },
            replace: true,
          })
        } catch (error) {
          if (error instanceof ApiError && error.status === 429) {
            return
          }

          const message =
            error instanceof Error && error.message
              ? error.message
              : 'Unable to create the scheduled job.'

          toast.error('Failed to create scheduled job', {
            description: message,
          })
        }
      }}
    />
  )
}
