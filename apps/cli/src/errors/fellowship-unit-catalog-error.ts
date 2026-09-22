import * as Data from "effect/Data";

export class FellowshipUnitCatalogJsonParseError extends Data.TaggedError(
  "FellowshipUnitCatalogJsonParseError",
)<{
  readonly cause: unknown;
  readonly filePath: string;
}> {
  override get message() {
    return `Invalid JSON in the Fellowship unit catalog: ${this.filePath}.`;
  }
}
