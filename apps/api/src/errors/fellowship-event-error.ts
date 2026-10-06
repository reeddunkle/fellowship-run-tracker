import * as Data from "effect/Data";

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
