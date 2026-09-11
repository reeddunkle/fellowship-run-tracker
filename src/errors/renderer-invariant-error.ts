import * as Data from "effect/Data";

export class RendererInvariantError extends Data.TaggedError(
  "RendererInvariantError",
)<{
  readonly message: string;
}> {}
