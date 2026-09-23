import * as Match from "effect/Match";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  HourglassIcon,
  RotateCcwIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";

import {
  type BackgroundJobApiItem,
  type ImportFellowshipLogsDungeonRunBackgroundJobApiItem,
} from "@frt/shared/background-job/background-job-api-schema.ts";
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
import {
  getWaitingImportMessage,
  WAITING_FOR_POINTS_MESSAGE,
} from "@/renderer/api/fellowship-logs/fellowship-logs-rate-limit-messages.ts";
import { useNowMilliseconds } from "@/renderer/api/fellowship-logs/use-fellowship-logs-rate-limit-status.ts";
import { useFellowshipDataStore } from "@/renderer/stores/fellowship-data/fellowship-data-store.tsx";
import { formatRelativeDateTimeFromMilliseconds } from "@/util/format-date-time.ts";

import { getImportJobFailureMessage } from "./get-import-job-failure-message.ts";

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

function ImportJobTitle({
  job,
}: {
  readonly job: ImportFellowshipLogsDungeonRunBackgroundJobApiItem;
}) {
  const dungeonsById = useFellowshipDataStore((state) => state.dungeonsById);

  const dungeonName =
    dungeonsById[job.payload.dungeonId]?.name ?? job.payload.dungeonId;

  return (
    <ItemTitle>
      {dungeonName} +{job.payload.dungeonLevel}
    </ItemTitle>
  );
}

function BackgroundJobTitle({ job }: { readonly job: BackgroundJobApiItem }) {
  return Match.value(job).pipe(
    Match.discriminatorsExhaustive("kind")({
      ImportFellowshipLogsDungeonRun: (importJob) => {
        return <ImportJobTitle job={importJob} />;
      },
    }),
  );
}

function getFailureMessage(job: BackgroundJobApiItem): string {
  return Match.value(job).pipe(
    Match.discriminatorsExhaustive("kind")({
      ImportFellowshipLogsDungeonRun: (importJob) => {
        return getImportJobFailureMessage(importJob.error);
      },
    }),
  );
}

function getWaitingMessage(
  job: BackgroundJobApiItem,
  nowMilliseconds: number,
): string {
  return Match.value(job).pipe(
    Match.discriminatorsExhaustive("kind")({
      ImportFellowshipLogsDungeonRun: (importJob) => {
        return getWaitingImportMessage(
          importJob.availableAtMilliseconds,
          nowMilliseconds,
        );
      },
    }),
  );
}

function WaitingStatusLine({ job }: { readonly job: BackgroundJobApiItem }) {
  const nowMilliseconds = useNowMilliseconds();

  return (
    <ItemDescription>{getWaitingMessage(job, nowMilliseconds)}</ItemDescription>
  );
}

function getQueuedDescription({
  isQueueWaiting,
  queuePosition,
}: {
  readonly isQueueWaiting: boolean;
  readonly queuePosition: number;
}): string {
  if (isQueueWaiting) {
    return WAITING_FOR_POINTS_MESSAGE;
  }

  return queuePosition === 1 ? "Up next" : `#${queuePosition} in line`;
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
    return <ItemDescription>{getFailureMessage(job)}</ItemDescription>;
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
      {getQueuedDescription({ isQueueWaiting, queuePosition })}
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
  /**
   * Whether a job ahead in the same queue is waiting, which holds queued jobs
   * until it can continue.
   */
  readonly isQueueWaiting: boolean;
  readonly job: BackgroundJobApiItem;
  /** 1-based position among queued jobs; unused for other statuses. */
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
        <BackgroundJobTitle job={job} />
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
