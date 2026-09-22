import * as Data from "effect/Data";

export class FellowshipEventUnsupportedTypeError extends Data.TaggedError(
  "FellowshipEventUnsupportedTypeError",
)<{
  readonly eventType: string | undefined;
  readonly line: string;
}> {
  override get message() {
    return this.eventType === undefined
      ? "Fellowship log line has no event type."
      : `Unsupported Fellowship event type: ${this.eventType}.`;
  }
}

export class FellowshipEventInvalidError extends Data.TaggedError(
  "FellowshipEventInvalidError",
)<{
  readonly cause: unknown;
  readonly line: string;
}> {
  override get message() {
    return "Fellowship log line isn't a valid event.";
  }
}
