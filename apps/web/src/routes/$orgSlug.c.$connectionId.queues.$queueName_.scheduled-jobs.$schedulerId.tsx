import { trackEvent } from '@durabull/analytics/browser'
import { AnalyticsEvents } from '@durabull/analytics/events'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ChevronRight, Layers } from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { useAppTopBar } from '@/components/app-top-bar'
import {
  ScheduledJobForm,
  type ScheduledJobFormInitialValue,
} from '@/components/scheduled-job-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useScheduledJob, useUpdateScheduledJob } from '@/hooks/use-queues'
import { ApiError } from '@/lib/api'

export const Route = createFileRoute(
  '/$orgSlug/c/$connectionId/queues/$queueName_/scheduled-jobs/$schedulerId'
)({
  component: ScheduledJobDetailPage,
})

function ScheduledJobDetailPage() {
  const { orgSlug, connectionId, queueName, schedulerId } = Route.useParams()
  const navigate = useNavigate()
  const { data, isLoading, error } = useScheduledJob(queueName, schedulerId)
  const updateScheduledJobMutation = useUpdateScheduledJob()

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

  useEffect(() => {
    if (!data?.scheduler) {
      return
    }

    trackEvent(AnalyticsEvents.SCHEDULED_JOB_UPDATED, {
      queue_name: queueName,
      scheduler_id: schedulerId,
      action: 'page_viewed',
    })
  }, [data?.scheduler, queueName, schedulerId])

  const title = data?.scheduler?.jobName ?? schedulerId

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
            <h1 className="truncate text-base font-semibold md:text-lg">{title}</h1>
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
    [connectionId, handleBack, orgSlug, queueName, title]
  )

  useAppTopBar(topBarConfig)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data?.scheduler) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="text-lg font-semibold">Scheduled job not found</div>
          <p className="text-sm text-muted-foreground">
            {error?.message ?? `Scheduler "${schedulerId}" could not be loaded.`}
          </p>
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Queue
          </Button>
        </CardContent>
      </Card>
    )
  }

  const initialValue: ScheduledJobFormInitialValue = {
    schedulerId: data.scheduler.schedulerId,
    jobName: data.scheduler.jobName,
    data: data.scheduler.data,
    pattern: data.scheduler.pattern,
    every: data.scheduler.every,
    timezone: data.scheduler.timezone,
    startDate: data.scheduler.startDate,
    endDate: data.scheduler.endDate,
    limit: data.scheduler.limit,
    templateOptions: data.scheduler.templateOptions,
    nextRun: data.scheduler.nextRun,
    iterationCount: data.scheduler.iterationCount,
    recentFailedCount: data.scheduler.recentFailedCount,
    lastFailedAt: data.scheduler.lastFailedAt,
  }

  return (
    <ScheduledJobForm
      mode="edit"
      queueName={queueName}
      initialValue={initialValue}
      existingSchedulerIds={[schedulerId]}
      isSubmitting={updateScheduledJobMutation.isPending}
      onCancel={handleBack}
      onSubmit={async (payload) => {
        try {
          const result = await updateScheduledJobMutation.mutateAsync({
            queueName,
            ...payload,
          })

          toast.success('Scheduled job updated', {
            description: `Scheduler ID: ${result.scheduler.schedulerId}`,
          })
        } catch (error) {
          if (error instanceof ApiError && error.status === 429) {
            return
          }

          const message =
            error instanceof Error && error.message
              ? error.message
              : 'Unable to save the scheduled job.'

          toast.error('Failed to update scheduled job', {
            description: message,
          })
        }
      }}
    />
  )
}
