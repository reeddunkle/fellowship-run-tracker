import * as Data from "effect/Data";

export class BiomeFixError extends Data.TaggedError("BiomeFixError")<{
  readonly cause: unknown;
  readonly filePaths: ReadonlyArray<string>;
}> {
  override get message() {
    return `Biome failed to fix ${this.filePaths.length} file(s).`;
  }
}
