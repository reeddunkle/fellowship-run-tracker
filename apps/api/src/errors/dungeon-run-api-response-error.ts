import * as Data from "effect/Data";

export class DungeonRunApiResponseError extends Data.TaggedError(
  "DungeonRunApiResponseError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to create the dungeon run history response.";
  }
}
