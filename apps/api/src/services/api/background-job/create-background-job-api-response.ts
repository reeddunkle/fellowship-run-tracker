import * as DateTime from "effect/DateTime";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { BackgroundJobSchema } from "@frt/api/services/background-job/background-job-schema.ts";
import { type VisibleBackgroundJob } from "@frt/api/services/background-job/background-job-service.ts";
import {
  type BackgroundJobApiItem,
  type ImportFellowshipLogsDungeonRunBackgroundJobApiItem,
  ImportFellowshipLogsDungeonRunJobPayloadSchema,
  ImportFellowshipLogsDungeonRunJobResultSchema,
} from "@frt/shared/background-job/background-job-api-schema.ts";

const decodeBackgroundJob = Schema.decodeUnknownOption(BackgroundJobSchema);

const decodeImportPayload = Schema.decodeUnknownOption(
  ImportFellowshipLogsDungeonRunJobPayloadSchema,
);

const decodeImportResult = Schema.decodeUnknownOption(
  Schema.NullOr(ImportFellowshipLogsDungeonRunJobResultSchema),
);

function toMillisecondsOrNull(dateTime: DateTime.Utc | null): number | null {
  return dateTime === null ? null : DateTime.toEpochMillis(dateTime);
}

function createBackgroundJobApiItemFields({
  job,
  progress,
}: VisibleBackgroundJob) {
  return {
    attempts: job.attempts,
    createdAtMilliseconds: DateTime.toEpochMillis(job.createdAt),
    error: job.error,
    finishedAtMilliseconds: toMillisecondsOrNull(job.finishedAt),
    id: job.id,
    progress,
    startedAtMilliseconds: toMillisecondsOrNull(job.startedAt),
    status: job.status,
  };
}

/**
 * Returns `None` when the row isn't an import job, or its stored JSON no
 * longer matches the current schema.
 */
export function createImportFellowshipLogsDungeonRunBackgroundJobApiItem(
  visibleJob: VisibleBackgroundJob,
): Option.Option<ImportFellowshipLogsDungeonRunBackgroundJobApiItem> {
  const { job } = visibleJob;

  if (job.kind !== "ImportFellowshipLogsDungeonRun") {
    return Option.none();
  }

  return Option.all({
    payload: decodeImportPayload(job.payload),
    result: decodeImportResult(job.result),
  }).pipe(
    Option.map(({ payload, result }) => {
      return {
        ...createBackgroundJobApiItemFields(visibleJob),
        kind: "ImportFellowshipLogsDungeonRun",
        payload,
        result,
      };
    }),
  );
}

/**
 * Returns `None` for job kinds that aren't shown to the user, and for rows
 * whose stored payload no longer decodes. Matching is exhaustive, so a new job
 * kind won't compile until it's either mapped here or explicitly hidden.
 */
export function createBackgroundJobApiItem(
  visibleJob: VisibleBackgroundJob,
): Option.Option<BackgroundJobApiItem> {
  return decodeBackgroundJob(visibleJob.job.payload).pipe(
    Option.flatMap((job) => {
      return Match.value(job).pipe(
        Match.tagsExhaustive({
          ImportFellowshipLogsDungeonRun: () => {
            return createImportFellowshipLogsDungeonRunBackgroundJobApiItem(
              visibleJob,
            );
          },
          InterruptUnfinishedDungeonRuns: () => {
            return Option.none<BackgroundJobApiItem>();
          },
          PruneFinishedBackgroundJobs: () => {
            return Option.none<BackgroundJobApiItem>();
          },
          PruneLogFiles: () => {
            return Option.none<BackgroundJobApiItem>();
          },
        }),
      );
    }),
  );
}
