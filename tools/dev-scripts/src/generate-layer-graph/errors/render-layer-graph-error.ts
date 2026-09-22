import * as Data from "effect/Data";

export class LayerGraphRenderError extends Data.TaggedError(
  "LayerGraphRenderError",
)<{
  readonly cause: unknown;
  readonly input: string;
  readonly output: string;
}> {
  override get message() {
    return `Failed to render Mermaid file "${this.input}" to "${this.output}".`;
  }
}
