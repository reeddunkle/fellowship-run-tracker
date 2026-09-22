import { inflateSync } from "node:zlib";

import { pipe } from "effect/Function";
import * as Schema from "effect/Schema";

import {
  MermaidGraphDecodeError,
  MermaidGraphUrlError,
  MermaidHoverResponseError,
} from "../errors/mermaid-live-error.ts";
import { type JsonRpcResponse } from "../validation/lsp-client-schema.ts";

const MermaidLiveStateSchema = Schema.Struct({
  code: Schema.String,
});

function getHoverMarkdown(response: JsonRpcResponse): string {
  if (
    typeof response.result !== "object" ||
    response.result === null ||
    !("contents" in response.result)
  ) {
    throw new MermaidHoverResponseError({
      reason: "MissingContents",
    });
  }

  const contents = response.result.contents;

  if (
    typeof contents !== "object" ||
    contents === null ||
    !("value" in contents) ||
    typeof contents.value !== "string"
  ) {
    throw new MermaidHoverResponseError({
      reason: "MissingMarkdownContents",
    });
  }

  return contents.value;
}

function getFullGraphUrl(markdown: string): string {
  const match = /\[Show full graph\]\((https:\/\/[^)]+)\)/.exec(markdown);
  const url = match?.[1];

  if (url === undefined) {
    throw new MermaidGraphUrlError();
  }

  return url;
}

function decodeMermaidLiveUrl(url: string): string {
  try {
    const fragment = new URL(url).hash;

    if (!fragment.startsWith("#pako:")) {
      throw new MermaidGraphDecodeError({
        reason: "UnsupportedUrl",
        url,
      });
    }

    return pipe(
      fragment.slice("#pako:".length),
      (encoded) => {
        return Buffer.from(encoded, "base64url");
      },
      inflateSync,
      (decoded) => {
        return decoded.toString("utf8");
      },
      JSON.parse,
      Schema.decodeUnknownSync(MermaidLiveStateSchema),
      ({ code }) => {
        return code;
      },
    );
  } catch (cause) {
    if (cause instanceof MermaidGraphDecodeError) {
      throw cause;
    }

    throw new MermaidGraphDecodeError({
      cause,
      reason: "DecodeFailed",
      url,
    });
  }
}

export function extractMermaidLayerGraph(
  hoverResponse: JsonRpcResponse,
): string {
  return pipe(
    hoverResponse,
    getHoverMarkdown,
    getFullGraphUrl,
    decodeMermaidLiveUrl,
  );
}
