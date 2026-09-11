import * as Data from "effect/Data";

export const DUNGEON_RUN_EVENT_MESSAGE_DECODE_ERROR =
  "DungeonRunEventMessageDecodeError" as const;

export class DungeonRunEventMessageDecodeError extends Data.TaggedError(
  DUNGEON_RUN_EVENT_MESSAGE_DECODE_ERROR,
)<{
  readonly cause: unknown;
}> {}
