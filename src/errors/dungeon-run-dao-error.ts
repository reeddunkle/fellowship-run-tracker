import * as Data from "effect/Data";

import { type DungeonRunId } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";

export type DungeonRunDAOErrorDetails =
  | {
      readonly _tag: "RunNotFound";
      readonly dungeonRunId: DungeonRunId;
    }
  | {
      readonly _tag: "RunNotReturnedAfterInsert";
      readonly dungeonRunId: DungeonRunId;
    }
  | {
      readonly _tag: "Unexpected";
      readonly cause: unknown;
    };

const DUNGEON_RUN_DAO_ERROR = "DungeonRunDAOError" as const;

export class DungeonRunDAOError extends Data.TaggedError(
  DUNGEON_RUN_DAO_ERROR,
)<{
  readonly details: DungeonRunDAOErrorDetails;
}> {}
