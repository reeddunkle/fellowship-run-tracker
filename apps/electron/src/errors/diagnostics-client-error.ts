import * as Data from "effect/Data";

const DIAGNOSTICS_CLIENT_OPERATION_DESCRIPTIONS = {
  OpenLogsFolder: "open the logs folder",
} as const;

export class DiagnosticsClientError extends Data.TaggedError(
  "DiagnosticsClientError",
)<{
  readonly cause: unknown;
  readonly operation: keyof typeof DIAGNOSTICS_CLIENT_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Failed to ${DIAGNOSTICS_CLIENT_OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}
