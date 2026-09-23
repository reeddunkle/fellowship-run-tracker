import * as Data from "effect/Data";

export class MermaidSubgraphError extends Data.TaggedError(
  "MermaidSubgraphError",
)<{
  readonly startIndex: number;
}> {
  override get message() {
    return `Could not find the end of Mermaid subgraph starting at line ${this.startIndex + 1}.`;
  }
}

export class MermaidGraphParseError extends Data.TaggedError(
  "MermaidGraphParseError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to parse the Mermaid graph.";
  }
}
