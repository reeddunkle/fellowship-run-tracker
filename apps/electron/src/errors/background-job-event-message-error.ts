import * as Data from "effect/Data";

export class BackgroundJobEventMessageDecodeError extends Data.TaggedError(
  "BackgroundJobEventMessageDecodeError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to decode a background job event message.";
  }
}
