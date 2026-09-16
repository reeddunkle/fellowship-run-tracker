import * as Data from "effect/Data";

export class DungeonRunApiResponseError extends Data.TaggedError(
  "DungeonRunApiServiceError",
)<{
  readonly cause: unknown;
  readonly message: string;
}> {}
