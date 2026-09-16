import * as Data from "effect/Data";

import { type DungeonRunId } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";

export type FellowshipLogsDungeonRunDAOErrorDetails =
  | {
      readonly _tag: "RunNotReturnedAfterInsert";
      readonly dungeonRunId: DungeonRunId;
    }
  | {
      readonly _tag: "Unexpected";
      readonly cause: unknown;
    };

const FELLOWSHIP_LOGS_DUNGEON_RUN_DAO_ERROR =
  "FellowshipLogsDungeonRunDAOError" as const;

export class FellowshipLogsDungeonRunDAOError extends Data.TaggedError(
  FELLOWSHIP_LOGS_DUNGEON_RUN_DAO_ERROR,
)<{
  readonly details: FellowshipLogsDungeonRunDAOErrorDetails;
}> {}
