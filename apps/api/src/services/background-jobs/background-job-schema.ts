import * as Schema from "effect/Schema";

const InterruptUnfinishedDungeonRunsJobSchema = Schema.TaggedStruct(
  "InterruptUnfinishedDungeonRuns",
  {
    createdBefore: Schema.DateTimeUtcFromMillis,
  },
);

export const BackgroundJobSchema = Schema.Union([
  InterruptUnfinishedDungeonRunsJobSchema,
]);

export type BackgroundJob = typeof BackgroundJobSchema.Type;
