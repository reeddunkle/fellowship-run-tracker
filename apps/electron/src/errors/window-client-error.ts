import * as Data from "effect/Data";

const WINDOW_CLIENT_OPERATION_DESCRIPTIONS = {
  ResizeToContent: "resize the window to its content",
} as const;

export class WindowClientError extends Data.TaggedError("WindowClientError")<{
  readonly cause: unknown;
  readonly operation: keyof typeof WINDOW_CLIENT_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Failed to ${WINDOW_CLIENT_OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}
