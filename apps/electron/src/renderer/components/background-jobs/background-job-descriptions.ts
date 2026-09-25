import * as Match from "effect/Match";

import { type BackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";

import {
  getWaitingImportMessage,
  WAITING_FOR_POINTS_MESSAGE,
} from "@/renderer/api/fellowship-logs/fellowship-logs-rate-limit-messages.ts";

import { getImportJobFailureMessage } from "./get-import-job-failure-message.ts";

export function getBackgroundJobFailureMessage(
  job: BackgroundJobApiItem,
): string {
  return Match.value(job).pipe(
    Match.discriminatorsExhaustive("kind")({
      ImportFellowshipLogsDungeonRun: (importJob) => {
        return getImportJobFailureMessage(importJob.error);
      },
    }),
  );
}

export function getBackgroundJobWaitingMessage(
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

const PointsFormatter = new Intl.NumberFormat("en-US");

export function getBackgroundJobResultDescription(
  job: BackgroundJobApiItem,
): string | null {
  return Match.value(job).pipe(
    Match.discriminatorsExhaustive("kind")({
      ImportFellowshipLogsDungeonRun: ({ result }) => {
        if (result === null || result.approximatePointsSpent === null) {
          return null;
        }

        return result.approximatePointsSpent === 0
          ? "no points used"
          : `~${PointsFormatter.format(result.approximatePointsSpent)} points`;
      },
    }),
  );
}

export function getBackgroundJobQueuedDescription({
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

export type BackgroundJobQueueContext = {
  readonly isQueueWaiting: boolean;
  readonly queuedJobIds: ReadonlyArray<BackgroundJobApiItem["id"]>;
};

export function getBackgroundJobQueueContext(
  jobs: ReadonlyArray<BackgroundJobApiItem>,
): BackgroundJobQueueContext {
  return {
    isQueueWaiting: jobs.some((job) => {
      return job.status === "WAITING";
    }),
    queuedJobIds: jobs
      .filter((job) => {
        return job.status === "QUEUED";
      })
      .map((job) => {
        return job.id;
      }),
  };
}
