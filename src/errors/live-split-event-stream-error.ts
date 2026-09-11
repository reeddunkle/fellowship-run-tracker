import * as Data from "effect/Data";

const LIVE_SPLIT_EVENT_MESSAGE_DECODE_ERROR =
  "LiveSplitEventMessageDecodeError" as const;

export class LiveSplitEventMessageDecodeError extends Data.TaggedError(
  LIVE_SPLIT_EVENT_MESSAGE_DECODE_ERROR,
)<{
  readonly cause: unknown;
}> {}
