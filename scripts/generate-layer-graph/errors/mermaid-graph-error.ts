import * as Data from "effect/Data";

export class MermaidSubgraphError extends Data.TaggedError(
  "MermaidSubgraphError",
)<{
  readonly message: string;
  readonly startIndex: number;
}> {}
