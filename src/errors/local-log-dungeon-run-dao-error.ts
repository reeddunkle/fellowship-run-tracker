import * as Data from "effect/Data";

import { type DungeonRunId } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";

export type LocalLogDungeonRunDAOErrorDetails =
  | {
      readonly _tag: "RunNotFoundOrInactive";
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

const LOCAL_LOG_DUNGEON_RUN_DAO_ERROR = "LocalLogDungeonRunDAOError" as const;

export class LocalLogDungeonRunDAOError extends Data.TaggedError(
  LOCAL_LOG_DUNGEON_RUN_DAO_ERROR,
)<{
  readonly details: LocalLogDungeonRunDAOErrorDetails;
}> {}
