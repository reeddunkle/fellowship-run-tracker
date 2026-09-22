import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";

import { EffectTsGoLsp } from "./effect-tsgo-lsp-service.ts";
import { type EffectTsGoLspError } from "./errors/effect-tsgo-lsp-error.ts";
import {
  type GetLayerLspGraphError,
  LayerGraphDocumentSymbolsError,
  LayerGraphSelectionError,
  LayerGraphSourceFileError,
} from "./errors/get-layer-lsp-graph-error.ts";
import { extractMermaidLayerGraph } from "./mermaid/mermaid-live.ts";
import { type JsonRpcResponse } from "./validation/lsp-client-schema.ts";

type Position = {
  readonly character: number;
  readonly line: number;
};

type Range = {
  readonly end: Position;
  readonly start: Position;
};

type DocumentSymbol = {
  readonly children?: ReadonlyArray<DocumentSymbol>;
  readonly detail?: string;
  readonly kind: number;
  readonly name: string;
  readonly range: Range;
  readonly selectionRange: Range;
};

type LayerGraphCandidate = {
  readonly mermaid: string;
  readonly symbol: DocumentSymbol;
};

export type GeneratedLayerGraph = {
  readonly mermaid: string;
  readonly symbolName: string;
};

function getDocumentSymbols(
  response: JsonRpcResponse,
): ReadonlyArray<DocumentSymbol> {
  if (!Array.isArray(response.result)) {
    throw new LayerGraphDocumentSymbolsError({
      cause: response.result,
      reason: "InvalidResponse",
    });
  }

  return response.result as ReadonlyArray<DocumentSymbol>;
}

function flattenDocumentSymbols(
  symbols: ReadonlyArray<DocumentSymbol>,
): ReadonlyArray<DocumentSymbol> {
  return pipe(
    symbols,
    A.flatMap((symbol) => {
      return [symbol, ...flattenDocumentSymbols(symbol.children ?? [])];
    }),
  );
}

function tryExtractMermaidLayerGraph(
  response: JsonRpcResponse,
): string | undefined {
  try {
    return extractMermaidLayerGraph(response);
  } catch {
    return undefined;
  }
}

function selectLayerGraphCandidate({
  candidates,
  sourceFile,
}: {
  readonly candidates: ReadonlyArray<LayerGraphCandidate>;
  readonly sourceFile: string;
}): LayerGraphCandidate {
  const candidate = pipe(
    candidates,
    A.reduce(
      undefined as LayerGraphCandidate | undefined,
      (largestCandidate, currentCandidate) => {
        if (
          largestCandidate === undefined ||
          currentCandidate.mermaid.length > largestCandidate.mermaid.length
        ) {
          return currentCandidate;
        }

        return largestCandidate;
      },
    ),
  );

  if (candidate === undefined) {
    throw new LayerGraphSelectionError({
      reason: "NoGraphFound",
      sourceFile,
    });
  }

  return candidate;
}

export function getLayerLspGraph({
  sourceFile,
}: {
  readonly sourceFile: string;
}): E.Effect<
  GeneratedLayerGraph,
  EffectTsGoLspError | GetLayerLspGraphError,
  EffectTsGoLsp | FileSystem.FileSystem
> {
  return E.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const lsp = yield* EffectTsGoLsp;

    const source = yield* fileSystem.readFileString(sourceFile).pipe(
      E.mapError((cause) => {
        return new LayerGraphSourceFileError({
          cause,
          sourceFile,
        });
      }),
    );

    const sourceUri = yield* lsp.getDocumentUri(sourceFile);

    yield* lsp.notify({
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          languageId: "typescript",
          text: source,
          uri: sourceUri,
          version: 1,
        },
      },
    });

    const documentSymbolResponse = yield* lsp.request({
      method: "textDocument/documentSymbol",
      params: {
        textDocument: {
          uri: sourceUri,
        },
      },
    });

    const documentSymbols = yield* E.try({
      catch: (cause) => {
        if (cause instanceof LayerGraphDocumentSymbolsError) {
          return cause;
        }

        return new LayerGraphDocumentSymbolsError({
          cause,
          reason: "RequestFailed",
        });
      },
      try: () => {
        return pipe(
          documentSymbolResponse,
          getDocumentSymbols,
          flattenDocumentSymbols,
        );
      },
    });

    yield* E.logInfo("Found document symbols.", {
      count: documentSymbols.length,
      file: sourceFile,
    });

    const hoverResponses = yield* E.forEach(
      documentSymbols,
      (symbol) => {
        return E.gen(function* () {
          const hoverResponse = yield* lsp.request({
            method: "textDocument/hover",
            params: {
              position: symbol.selectionRange.start,
              textDocument: {
                uri: sourceUri,
              },
            },
          });

          return {
            hoverResponse,
            symbol,
          };
        });
      },
      {
        concurrency: 1,
        discard: false,
      },
    );

    const layerGraphCandidates = pipe(
      hoverResponses,
      A.flatMap((hoverResult) => {
        const mermaid = tryExtractMermaidLayerGraph(hoverResult.hoverResponse);

        if (mermaid === undefined) {
          return [];
        }

        return [
          {
            mermaid,
            symbol: hoverResult.symbol,
          },
        ];
      }),
    );

    yield* E.logInfo("Found Effect Layer graph candidates.", {
      count: layerGraphCandidates.length,
      symbols: pipe(
        layerGraphCandidates,
        A.map((candidate) => {
          return candidate.symbol.name;
        }),
      ),
    });

    const selectedCandidate = yield* E.try({
      catch: (cause) => {
        if (cause instanceof LayerGraphSelectionError) {
          return cause;
        }

        return new LayerGraphSelectionError({
          cause,
          reason: "SelectionFailed",
          sourceFile,
        });
      },
      try: () => {
        return selectLayerGraphCandidate({
          candidates: layerGraphCandidates,
          sourceFile,
        });
      },
    });

    return {
      mermaid: `${selectedCandidate.mermaid.trimEnd()}\n`,
      symbolName: selectedCandidate.symbol.name,
    };
  });
}
