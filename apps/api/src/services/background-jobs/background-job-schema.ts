import * as Schema from "effect/Schema";

const InterruptUnfinishedDungeonRunsJobSchema = Schema.TaggedStruct(
  "InterruptUnfinishedDungeonRuns",
  {
    createdBefore: Schema.DateTimeUtcFromMillis,
  },
);

const PruneLogFilesJobSchema = Schema.TaggedStruct("PruneLogFiles", {});

export const BackgroundJobSchema = Schema.Union([
  InterruptUnfinishedDungeonRunsJobSchema,
  PruneLogFilesJobSchema,
]);

export type BackgroundJob = typeof BackgroundJobSchema.Type;
