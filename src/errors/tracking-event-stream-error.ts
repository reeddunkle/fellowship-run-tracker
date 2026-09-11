import * as Data from "effect/Data";

const TRACKING_EVENT_MESSAGE_DECODE_ERROR =
  "TrackingEventMessageDecodeError" as const;

export class TrackingEventMessageDecodeError extends Data.TaggedError(
  TRACKING_EVENT_MESSAGE_DECODE_ERROR,
)<{
  readonly cause: unknown;
}> {}
