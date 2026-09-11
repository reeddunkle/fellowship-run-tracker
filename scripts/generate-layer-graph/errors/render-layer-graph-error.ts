import * as Data from "effect/Data";

export class LayerGraphRenderError extends Data.TaggedError(
  "LayerGraphRenderError",
)<{
  readonly cause: unknown;
  readonly input: string;
  readonly message: string;
  readonly output: string;
}> {}
