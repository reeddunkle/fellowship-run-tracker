import * as Data from "effect/Data";

export class LiveSplitClientInvalidResponseError extends Data.TaggedError(
  "LiveSplitClientInvalidResponseError",
)<{
  readonly command: string;
  readonly response: string;
}> {
  override get message() {
    return `LiveSplit returned an invalid response for "${this.command}": "${this.response}".`;
  }
}

const UNAVAILABLE_REASON_DESCRIPTIONS = {
  ResponseStreamDesynchronized:
    "a previous request timed out and the response stream may no longer be synchronized",
  ResponseStreamEnded: "the LiveSplit response stream ended",
} as const;

export class LiveSplitClientUnavailableError extends Data.TaggedError(
  "LiveSplitClientUnavailableError",
)<{
  readonly reason: keyof typeof UNAVAILABLE_REASON_DESCRIPTIONS;
}> {
  override get message() {
    return `The LiveSplit client is unavailable: ${UNAVAILABLE_REASON_DESCRIPTIONS[this.reason]}.`;
  }
}

export class LiveSplitClientConnectionError extends Data.TaggedError(
  "LiveSplitClientConnectionError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to connect to LiveSplit.";
  }
}
