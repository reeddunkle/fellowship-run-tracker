import * as Data from "effect/Data";

export class Sha256Error extends Data.TaggedError("Sha256Error")<{
  readonly cause: unknown;
}> {}
