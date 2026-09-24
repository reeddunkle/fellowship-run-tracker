import * as Schema from "effect/Schema";

import { BackgroundJobFailureSchema } from "@frt/shared/background-job/background-job-failure-schema.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";
import { BackgroundJobStatusSchema } from "@frt/shared/background-job/background-job-status-schema.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { DungeonIdSchema } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import {
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

export const ImportFellowshipLogsDungeonRunJobPayloadSchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  dungeonLevel: PositiveIntegerSchema,
  fightId: FellowshipLogsFightIdSchema,
  isOwnRun: Schema.Boolean,
  reportCode: FellowshipLogsReportCodeSchema,
});

export const ImportFellowshipLogsDungeonRunJobResultSchema = Schema.Struct({
  dungeonRunId: DungeonRunIdSchema,
});

const BackgroundJobProgressSchema = Schema.Finite.check(
  Schema.isBetween({ maximum: 1, minimum: 0 }),
);

const BackgroundJobApiItemFields = {
  attempts: NonNegativeIntegerSchema,
  availableAtMilliseconds: Schema.NullOr(NonNegativeIntegerSchema),
  createdAtMilliseconds: NonNegativeIntegerSchema,

  error: Schema.NullOr(BackgroundJobFailureSchema),
  finishedAtMilliseconds: Schema.NullOr(NonNegativeIntegerSchema),
  id: BackgroundJobIdSchema,
  progress: Schema.NullOr(BackgroundJobProgressSchema),
  startedAtMilliseconds: Schema.NullOr(NonNegativeIntegerSchema),
  status: BackgroundJobStatusSchema,
};

export const ImportFellowshipLogsDungeonRunBackgroundJobApiItemSchema =
  Schema.Struct({
    ...BackgroundJobApiItemFields,
    kind: Schema.Literal("ImportFellowshipLogsDungeonRun"),
    payload: ImportFellowshipLogsDungeonRunJobPayloadSchema,
    result: Schema.NullOr(ImportFellowshipLogsDungeonRunJobResultSchema),
  });

export type ImportFellowshipLogsDungeonRunBackgroundJobApiItem =
  typeof ImportFellowshipLogsDungeonRunBackgroundJobApiItemSchema.Type;

const BackgroundJobApiItemSchema = Schema.Union([
  ImportFellowshipLogsDungeonRunBackgroundJobApiItemSchema,
]);

export type BackgroundJobApiItem = typeof BackgroundJobApiItemSchema.Type;

export const BackgroundJobApiSnapshotSchema = Schema.Struct({
  jobs: Schema.Array(BackgroundJobApiItemSchema),
  revision: NonNegativeIntegerSchema,
  sessionId: Schema.String,
});

export type BackgroundJobApiSnapshot =
  typeof BackgroundJobApiSnapshotSchema.Type;
