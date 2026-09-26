import * as Data from "effect/Data";

export class ElectronWindowCreationError extends Data.TaggedError(
  "ElectronWindowCreationError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to create the application window.";
  }
}

export class ElectronOpenLogsFolderError extends Data.TaggedError(
  "ElectronOpenLogsFolderError",
)<{
  readonly reason: string;
}> {
  override get message() {
    return `Failed to open the logs folder: ${this.reason}`;
  }
}
