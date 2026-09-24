import * as Schema from "effect/Schema";

import { ImportFellowshipLogsDungeonRunJobPayloadSchema } from "@frt/shared/background-job/background-job-api-schema.ts";

const ImportFellowshipLogsDungeonRunJobSchema = Schema.TaggedStruct(
  "ImportFellowshipLogsDungeonRun",
  ImportFellowshipLogsDungeonRunJobPayloadSchema.fields,
);

const InterruptUnfinishedDungeonRunsJobSchema = Schema.TaggedStruct(
  "InterruptUnfinishedDungeonRuns",
  {
    createdBefore: Schema.DateTimeUtcFromMillis,
  },
);

const PruneFinishedBackgroundJobsJobSchema = Schema.TaggedStruct(
  "PruneFinishedBackgroundJobs",
  {
    finishedBefore: Schema.DateTimeUtcFromMillis,
  },
);

const PruneFellowshipLogsCacheJobSchema = Schema.TaggedStruct(
  "PruneFellowshipLogsCache",
  {},
);

const PruneLogFilesJobSchema = Schema.TaggedStruct("PruneLogFiles", {});

export const BackgroundJobSchema = Schema.Union([
  ImportFellowshipLogsDungeonRunJobSchema,
  InterruptUnfinishedDungeonRunsJobSchema,
  PruneFellowshipLogsCacheJobSchema,
  PruneFinishedBackgroundJobsJobSchema,
  PruneLogFilesJobSchema,
]);

export type BackgroundJob = typeof BackgroundJobSchema.Type;

export type BackgroundJobKind = BackgroundJob["_tag"];
