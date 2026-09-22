import * as Data from "effect/Data";

export class MilestoneConfigurationJsonError extends Data.TaggedError(
  "MilestoneConfigurationJsonError",
)<{
  readonly cause: unknown;
  readonly filePath: string;
}> {
  override get message() {
    return `Invalid JSON in milestone configuration file: ${this.filePath}.`;
  }
}
