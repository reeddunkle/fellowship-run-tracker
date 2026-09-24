import {
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  HourglassIcon,
  RotateCcwIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";

import { type BackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";
import { Button } from "@frt/ui/button.tsx";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@frt/ui/item.tsx";
import { Progress } from "@frt/ui/progress.tsx";
import { Spinner } from "@frt/ui/spinner.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@frt/ui/tooltip.tsx";

import {
  useCancelBackgroundJob,
  useDismissBackgroundJob,
  useRetryBackgroundJob,
} from "@/renderer/api/background-job/background-job-mutations.ts";
import { useNowMilliseconds } from "@/renderer/stores/clock/use-now-milliseconds.ts";
import { formatRelativeDateTimeFromMilliseconds } from "@/util/format-date-time.ts";

import {
  getBackgroundJobFailureMessage,
  getBackgroundJobQueuedDescription,
  getBackgroundJobWaitingMessage,
} from "./background-job-descriptions.ts";
import { BackgroundJobName } from "./background-job-name.tsx";

function BackgroundJobStatusIcon({
  job,
}: {
  readonly job: BackgroundJobApiItem;
}) {
  if (job.status === "RUNNING") {
    return <Spinner />;
  }

  if (job.status === "FAILED") {
    return <CircleAlertIcon className="text-destructive" />;
  }

  if (job.status === "SUCCEEDED") {
    return <CircleCheckIcon className="text-primary" />;
  }

  if (job.status === "WAITING") {
    return <HourglassIcon className="text-muted-foreground" />;
  }

  return <ClockIcon className="text-muted-foreground" />;
}

function WaitingStatusLine({ job }: { readonly job: BackgroundJobApiItem }) {
  const nowMilliseconds = useNowMilliseconds();

  return (
    <ItemDescription>
      {getBackgroundJobWaitingMessage(job, nowMilliseconds)}
    </ItemDescription>
  );
}

function BackgroundJobStatusLine({
  isQueueWaiting,
  job,
  queuePosition,
}: {
  readonly isQueueWaiting: boolean;
  readonly job: BackgroundJobApiItem;
  readonly queuePosition: number;
}) {
  if (job.status === "RUNNING") {
    return job.progress === null ? (
      <ItemDescription>Starting…</ItemDescription>
    ) : (
      <div className="flex items-center gap-2">
        <Progress
          aria-label="Import progress"
          className="max-w-48"
          value={job.progress}
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(job.progress * 100)}%
        </span>
      </div>
    );
  }

  if (job.status === "FAILED") {
    return (
      <ItemDescription>{getBackgroundJobFailureMessage(job)}</ItemDescription>
    );
  }

  if (job.status === "WAITING") {
    return <WaitingStatusLine job={job} />;
  }

  if (job.status === "SUCCEEDED") {
    return (
      <ItemDescription>
        {job.finishedAtMilliseconds === null
          ? "Finished"
          : `Finished ${formatRelativeDateTimeFromMilliseconds(job.finishedAtMilliseconds)}`}
      </ItemDescription>
    );
  }

  return (
    <ItemDescription>
      {getBackgroundJobQueuedDescription({ isQueueWaiting, queuePosition })}
    </ItemDescription>
  );
}

function BackgroundJobActions({ job }: { readonly job: BackgroundJobApiItem }) {
  const cancelMutation = useCancelBackgroundJob();
  const dismissMutation = useDismissBackgroundJob();
  const retryMutation = useRetryBackgroundJob();

  if (
    job.status === "QUEUED" ||
    job.status === "RUNNING" ||
    job.status === "WAITING"
  ) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Cancel job"
              disabled={cancelMutation.isPending}
              onClick={() => {
                cancelMutation.cancel({ id: job.id });
              }}
              size="icon"
              type="button"
              variant="destructive"
            />
          }
        >
          <SquareIcon className="fill-current" />
        </TooltipTrigger>
        <TooltipContent>Cancel</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      {job.status === "FAILED" ? (
        <Button
          disabled={retryMutation.isPending}
          onClick={() => {
            retryMutation.retry({ id: job.id });
          }}
          type="button"
          variant="outline"
        >
          <RotateCcwIcon />
          Retry
        </Button>
      ) : null}
      <Button
        aria-label="Dismiss"
        disabled={dismissMutation.isPending}
        onClick={() => {
          dismissMutation.dismiss({ id: job.id });
        }}
        size="icon"
        title="Dismiss"
        type="button"
        variant="ghost"
      >
        <XIcon />
      </Button>
    </>
  );
}

type BackgroundJobRowProps = {
  readonly isQueueWaiting: boolean;
  readonly job: BackgroundJobApiItem;
  readonly queuePosition: number;
};

export function BackgroundJobRow({
  isQueueWaiting,
  job,
  queuePosition,
}: BackgroundJobRowProps) {
  return (
    <Item variant="outline">
      <ItemMedia variant="icon">
        <BackgroundJobStatusIcon job={job} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <BackgroundJobName job={job} />
        </ItemTitle>
        <BackgroundJobStatusLine
          isQueueWaiting={isQueueWaiting}
          job={job}
          queuePosition={queuePosition}
        />
      </ItemContent>
      <ItemActions>
        <BackgroundJobActions job={job} />
      </ItemActions>
    </Item>
  );
}
