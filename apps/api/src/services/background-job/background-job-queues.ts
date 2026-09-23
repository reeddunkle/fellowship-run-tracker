import * as R from "effect/Record";

import { type BackgroundJobKind } from "@frt/api/services/background-job/background-job-schema.ts";

type BackgroundJobQueueOptions = {
  /**
   * Whether one waiting job holds up the whole queue until it can run again.
   * Fellowship Logs imports all spend the same points, so when one is waiting
   * for them to reset, the rest would only be turned away too.
   */
  readonly holdWhileWaiting: boolean;
  /** Whether the queue's jobs are shown to the user. */
  readonly isVisible: boolean;
  /**
   * How many times a job may be claimed before a restart gives up on it. Only
   * crashes or app exits mid-run use extra attempts; a job that fails normally
   * is marked failed straight away.
   */
  readonly maxAttempts: number;
};

/*
 * Each queue has its own worker that runs one job at a time, so a long
 * Fellowship Logs import never holds up maintenance work.
 */
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

/** Queues whose jobs are never shown, so nobody can dismiss their failures. */
export const HIDDEN_BACKGROUND_JOB_QUEUE_NAMES = R.keys(
  BACKGROUND_JOB_QUEUES,
).filter((queue) => {
  return !BACKGROUND_JOB_QUEUES[queue].isVisible;
});

export const BACKGROUND_JOB_QUEUE_BY_KIND = {
  ImportFellowshipLogsDungeonRun: "fellowship-logs-import",
  InterruptUnfinishedDungeonRuns: "maintenance",
  PruneFinishedBackgroundJobs: "maintenance",
  PruneLogFiles: "maintenance",
} as const satisfies Record<BackgroundJobKind, BackgroundJobQueueName>;
