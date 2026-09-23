import * as Schema from "effect/Schema";

import { DungeonIdSchema } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { BackgroundJobFailureSchema } from "@frt/shared/validation/background-job/background-job-failure-schema.ts";
import { BackgroundJobIdSchema } from "@frt/shared/validation/background-job/background-job-id-schema.ts";
import { BackgroundJobStatusSchema } from "@frt/shared/validation/background-job/background-job-status-schema.ts";
import {
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
} from "@frt/shared/validation/common-schemas.ts";
import { DungeonRunIdSchema } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

/*
 * `dungeonId` and `dungeonLevel` are for display only: they come from the
 * metadata lookup the renderer does before queueing, so the queue can show
 * which run is waiting without another Fellowship Logs request.
 */
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
  /** When a waiting job will run again; `null` unless it's waiting. */
  availableAtMilliseconds: Schema.NullOr(NonNegativeIntegerSchema),
  createdAtMilliseconds: NonNegativeIntegerSchema,
  /**
   * Why a job failed, or, while it's waiting, why it has to wait.
   */
  error: Schema.NullOr(BackgroundJobFailureSchema),
  finishedAtMilliseconds: Schema.NullOr(NonNegativeIntegerSchema),
  id: BackgroundJobIdSchema,
  /** How far a running job has got, from 0 to 1; `null` when not reported. */
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

/*
 * One member per user-visible job kind, discriminated by `kind`.
 */
const BackgroundJobApiItemSchema = Schema.Union([
  ImportFellowshipLogsDungeonRunBackgroundJobApiItemSchema,
]);

export type BackgroundJobApiItem = typeof BackgroundJobApiItemSchema.Type;

/*
 * The full list of user-visible jobs. `sessionId` changes whenever the API
 * restarts and `revision` increases with every change, so clients can ignore
 * snapshots older than one they already have.
 */
export const BackgroundJobApiSnapshotSchema = Schema.Struct({
  jobs: Schema.Array(BackgroundJobApiItemSchema),
  revision: NonNegativeIntegerSchema,
  sessionId: Schema.String,
});

export type BackgroundJobApiSnapshot =
  typeof BackgroundJobApiSnapshotSchema.Type;
