import * as Data from "effect/Data";

export class LayerGraphSourceFileError extends Data.TaggedError(
  "LayerGraphSourceFileError",
)<{
  readonly message: string;
  readonly sourceFile: string;
  readonly cause: unknown;
}> {}

export class LayerGraphDocumentSymbolsError extends Data.TaggedError(
  "LayerGraphDocumentSymbolsError",
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class LayerGraphSelectionError extends Data.TaggedError(
  "LayerGraphSelectionError",
)<{
  readonly message: string;
  readonly sourceFile: string;
}> {}

export type GetLayerLspGraphError =
  | LayerGraphDocumentSymbolsError
  | LayerGraphSelectionError
  | LayerGraphSourceFileError;
