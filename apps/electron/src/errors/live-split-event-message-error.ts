import * as Data from "effect/Data";

export class LiveSplitEventMessageDecodeError extends Data.TaggedError(
  "LiveSplitEventMessageDecodeError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to decode a LiveSplit event message.";
  }
}
