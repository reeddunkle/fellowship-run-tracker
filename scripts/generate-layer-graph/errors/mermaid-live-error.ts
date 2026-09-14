import * as Data from "effect/Data";

export class MermaidHoverResponseError extends Data.TaggedError(
  "MermaidHoverResponseError",
)<{
  readonly message: string;
}> {}

export class MermaidGraphUrlError extends Data.TaggedError(
  "MermaidGraphUrlError",
)<{
  readonly message: string;
}> {}

export class MermaidGraphDecodeError extends Data.TaggedError(
  "MermaidGraphDecodeError",
)<{
  readonly cause?: unknown;
  readonly message: string;
  readonly url: string;
}> {}
