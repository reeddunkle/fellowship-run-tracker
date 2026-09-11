import * as Data from "effect/Data";

const MILESTONE_CONFIGURATION_JSON_ERROR =
  "MilestoneConfigurationJsonError" as const;

export class MilestoneConfigurationJsonError extends Data.TaggedError(
  MILESTONE_CONFIGURATION_JSON_ERROR,
)<{
  readonly cause: unknown;
  readonly filePath: string;
}> {}
