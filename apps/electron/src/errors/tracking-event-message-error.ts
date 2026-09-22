import * as Data from "effect/Data";

export class TrackingEventMessageDecodeError extends Data.TaggedError(
  "TrackingEventMessageDecodeError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to decode a tracking event message.";
  }
}
