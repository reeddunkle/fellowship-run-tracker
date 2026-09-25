import * as R from "effect/Record";

import { type BackgroundJobKind } from "@frt/api/services/background-job-queue/background-job-payload-schema.ts";

type BackgroundJobQueueOptions = {
  readonly holdWhileWaiting: boolean;
  readonly isVisible: boolean;
  readonly maxAttempts: number;
};

export const BACKGROUND_JOB_QUEUES = {
  "fellowship-logs-import": {
    holdWhileWaiting: true,
    isVisible: true,
    maxAttempts: 3,
  },
  maintenance: {
    holdWhileWaiting: false,
    isVisible: false,
    maxAttempts: 3,
  },
} as const satisfies Record<string, BackgroundJobQueueOptions>;

export type BackgroundJobQueueName = keyof typeof BACKGROUND_JOB_QUEUES;

export const HIDDEN_BACKGROUND_JOB_QUEUE_NAMES = R.keys(
  BACKGROUND_JOB_QUEUES,
).filter((queue) => {
  return !BACKGROUND_JOB_QUEUES[queue].isVisible;
});

export const BACKGROUND_JOB_QUEUE_BY_KIND = {
  ImportFellowshipLogsDungeonRun: "fellowship-logs-import",
  InterruptUnfinishedDungeonRuns: "maintenance",
  PruneFellowshipLogsCache: "maintenance",
  PruneFinishedBackgroundJobs: "maintenance",
  PruneLogFiles: "maintenance",
} as const satisfies Record<BackgroundJobKind, BackgroundJobQueueName>;
