import { type BackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";
import { cn } from "@frt/ui/class-names.ts";

import { useNowMilliseconds } from "@/renderer/stores/clock/use-now-milliseconds.ts";

import {
  type BackgroundJobQueueContext,
  getBackgroundJobFailureMessage,
  getBackgroundJobQueuedDescription,
  getBackgroundJobWaitingMessage,
} from "./background-job-descriptions.ts";

function WaitingStatus({ job }: { readonly job: BackgroundJobApiItem }) {
  const nowMilliseconds = useNowMilliseconds();

  return getBackgroundJobWaitingMessage(job, nowMilliseconds);
}

function BackgroundJobToastStatus({
  job,
  queueContext,
}: {
  readonly job: BackgroundJobApiItem;
  readonly queueContext: BackgroundJobQueueContext;
}) {
  if (job.status === "RUNNING") {
    return job.progress === null
      ? "Starting…"
      : `${Math.round(job.progress * 100)}%`;
  }

  if (job.status === "FAILED") {
    return getBackgroundJobFailureMessage(job);
  }

  if (job.status === "WAITING") {
    return <WaitingStatus job={job} />;
  }

  if (job.status === "SUCCEEDED") {
    return "Finished";
  }

  return getBackgroundJobQueuedDescription({
    isQueueWaiting: queueContext.isQueueWaiting,
    queuePosition: queueContext.queuedJobIds.indexOf(job.id) + 1,
  });
}

export function BackgroundJobToastDescription({
  job,
  queueContext,
}: {
  readonly job: BackgroundJobApiItem;
  readonly queueContext: BackgroundJobQueueContext;
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        job.status === "FAILED" && "text-destructive",
      )}
    >
      <BackgroundJobToastStatus job={job} queueContext={queueContext} />
    </span>
  );
}
