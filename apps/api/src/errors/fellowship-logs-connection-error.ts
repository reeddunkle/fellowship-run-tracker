import * as Data from "effect/Data";

import { type FellowshipLogsConnectionProfile } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const FELLOWSHIP_LOGS_CONNECTION_OPERATION_DESCRIPTIONS = {
  Disconnect: "disconnect from Fellowship Logs",
  Read: "read the Fellowship Logs connection",
  Save: "save the Fellowship Logs connection",
  Unprotect: "read protected Fellowship Logs credentials",
} as const;

export class FellowshipLogsConnectionError extends Data.TaggedError(
  "FellowshipLogsConnectionError",
)<{
  readonly cause: unknown;
  readonly operation: keyof typeof FELLOWSHIP_LOGS_CONNECTION_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Failed to ${FELLOWSHIP_LOGS_CONNECTION_OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}

export class FellowshipLogsConnectionChangedError extends Data.TaggedError(
  "FellowshipLogsConnectionChangedError",
)<Record<never, never>> {
  override get message() {
    return "The Fellowship Logs connection changed before it could be replaced.";
  }
}

export class FellowshipLogsConnectionReplacementRequiredError extends Data.TaggedError(
  "FellowshipLogsConnectionReplacementRequiredError",
)<{
  readonly currentProfile: FellowshipLogsConnectionProfile;
}> {
  override get message() {
    return "Replacing the active Fellowship Logs connection requires confirmation.";
  }
}

export class FellowshipLogsNotConnectedError extends Data.TaggedError(
  "FellowshipLogsNotConnectedError",
)<Record<never, never>> {
  override get message() {
    return "Fellowship Logs is not connected.";
  }
}
