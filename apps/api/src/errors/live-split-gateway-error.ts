import * as Data from "effect/Data";

export class LiveSplitGatewayInvalidResponseError extends Data.TaggedError(
  "LiveSplitGatewayInvalidResponseError",
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

export class LiveSplitGatewayUnavailableError extends Data.TaggedError(
  "LiveSplitGatewayUnavailableError",
)<{
  readonly reason: keyof typeof UNAVAILABLE_REASON_DESCRIPTIONS;
}> {
  override get message() {
    return `The LiveSplit client is unavailable: ${UNAVAILABLE_REASON_DESCRIPTIONS[this.reason]}.`;
  }
}

export class LiveSplitGatewayConnectionError extends Data.TaggedError(
  "LiveSplitGatewayConnectionError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to connect to LiveSplit.";
  }
}

export class LiveSplitGatewayNotConnectedError extends Data.TaggedError(
  "LiveSplitGatewayNotConnectedError",
) {
  override get message() {
    return "LiveSplit is not connected.";
  }
}
