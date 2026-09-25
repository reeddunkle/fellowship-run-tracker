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
