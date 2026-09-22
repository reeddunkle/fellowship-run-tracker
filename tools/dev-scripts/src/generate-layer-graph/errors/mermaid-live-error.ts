import * as Data from "effect/Data";

const HOVER_RESPONSE_REASON_DESCRIPTIONS = {
  MissingContents: "Hover response did not contain contents.",
  MissingMarkdownContents: "Hover response did not contain Markdown contents.",
} as const;

export class MermaidHoverResponseError extends Data.TaggedError(
  "MermaidHoverResponseError",
)<{
  readonly reason: keyof typeof HOVER_RESPONSE_REASON_DESCRIPTIONS;
}> {
  override get message() {
    return HOVER_RESPONSE_REASON_DESCRIPTIONS[this.reason];
  }
}

export class MermaidGraphUrlError extends Data.TaggedError(
  "MermaidGraphUrlError",
) {
  override get message() {
    return "Could not find the full Mermaid graph URL.";
  }
}

export class MermaidGraphDecodeError extends Data.TaggedError(
  "MermaidGraphDecodeError",
)<{
  readonly cause?: unknown;
  readonly reason: "DecodeFailed" | "UnsupportedUrl";
  readonly url: string;
}> {
  override get message() {
    return this.reason === "UnsupportedUrl"
      ? `Unsupported Mermaid URL: ${this.url}`
      : `Failed to decode Mermaid graph URL: ${this.url}`;
  }
}
