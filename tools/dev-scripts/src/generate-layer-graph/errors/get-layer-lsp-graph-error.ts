import * as Data from "effect/Data";

export class LayerGraphSourceFileError extends Data.TaggedError(
  "LayerGraphSourceFileError",
)<{
  readonly cause: unknown;
  readonly sourceFile: string;
}> {
  override get message() {
    return `Failed to read source file: ${this.sourceFile}`;
  }
}

const DOCUMENT_SYMBOLS_REASON_DESCRIPTIONS = {
  InvalidResponse: "Document symbol response was not an array.",
  RequestFailed: "Failed to read document symbols from the LSP.",
} as const;

export class LayerGraphDocumentSymbolsError extends Data.TaggedError(
  "LayerGraphDocumentSymbolsError",
)<{
  readonly cause: unknown;
  readonly reason: keyof typeof DOCUMENT_SYMBOLS_REASON_DESCRIPTIONS;
}> {
  override get message() {
    return DOCUMENT_SYMBOLS_REASON_DESCRIPTIONS[this.reason];
  }
}

export class LayerGraphSelectionError extends Data.TaggedError(
  "LayerGraphSelectionError",
)<{
  readonly cause?: unknown;
  readonly reason: "NoGraphFound" | "SelectionFailed";
  readonly sourceFile: string;
}> {
  override get message() {
    return this.reason === "NoGraphFound"
      ? `No Effect Layer graph was found in ${this.sourceFile}.`
      : `Failed to select an Effect Layer graph in ${this.sourceFile}.`;
  }
}

export type GetLayerLspGraphError =
  | LayerGraphDocumentSymbolsError
  | LayerGraphSelectionError
  | LayerGraphSourceFileError;
