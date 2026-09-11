import * as Data from "effect/Data";

export class FellowshipUnsupportedEventTypeError extends Data.TaggedError(
  "FellowshipUnsupportedEventTypeError",
)<{
  readonly eventType: string | undefined;
  readonly line: string;
}> {}

export class FellowshipInvalidEventError extends Data.TaggedError(
  "FellowshipInvalidEventError",
)<{
  readonly cause: unknown;
  readonly line: string;
}> {}
