import * as Data from "effect/Data";

import { type DungeonRunId } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";

export type DungeonRunObservationDAOErrorDetails =
  | {
      readonly _tag: "RunNotFoundOrInactive";
      readonly dungeonRunId: DungeonRunId;
    }
  | {
      readonly _tag: "Unexpected";
      readonly cause: unknown;
    };

const DUNGEON_RUN_OBSERVATION_DAO_ERROR =
  "DungeonRunObservationDAOError" as const;

export class DungeonRunObservationDAOError extends Data.TaggedError(
  DUNGEON_RUN_OBSERVATION_DAO_ERROR,
)<{
  readonly details: DungeonRunObservationDAOErrorDetails;
}> {}
