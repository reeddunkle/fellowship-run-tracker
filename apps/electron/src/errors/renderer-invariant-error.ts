import * as Data from "effect/Data";

export class RendererInvariantError extends Data.TaggedError(
  "RendererInvariantError",
)<{
  readonly description: string;
}> {
  override get message() {
    return `Renderer invariant violated: ${this.description}`;
  }
}
