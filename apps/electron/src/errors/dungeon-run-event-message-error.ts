import * as Data from "effect/Data";

export class DungeonRunEventMessageDecodeError extends Data.TaggedError(
  "DungeonRunEventMessageDecodeError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to decode a dungeon run event message.";
  }
}
