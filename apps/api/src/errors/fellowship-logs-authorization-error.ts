import * as Data from "effect/Data";

const FELLOWSHIP_LOGS_AUTHORIZATION_OPERATION_DESCRIPTIONS = {
  Cancel: "cancel Fellowship Logs authorization",
  Complete: "complete Fellowship Logs authorization",
  Listen: "listen for the Fellowship Logs authorization callback",
  Read: "read the pending Fellowship Logs authorization",
  Start: "start Fellowship Logs authorization",
} as const;

export class FellowshipLogsAuthorizationError extends Data.TaggedError(
  "FellowshipLogsAuthorizationError",
)<{
  readonly cause: unknown;
  readonly operation: keyof typeof FELLOWSHIP_LOGS_AUTHORIZATION_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Failed to ${FELLOWSHIP_LOGS_AUTHORIZATION_OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}

const FELLOWSHIP_LOGS_AUTHORIZATION_CALLBACK_REASON_DESCRIPTIONS = {
  Expired: "The Fellowship Logs authorization expired. Start again.",
  InvalidCallback:
    "The Fellowship Logs authorization response is not a valid callback for the pending authorization.",
  NoPendingAuthorization:
    "There is no pending Fellowship Logs authorization to complete.",
  StateMismatch:
    "The Fellowship Logs authorization response does not belong to the pending authorization.",
} as const;

export class FellowshipLogsAuthorizationCallbackError extends Data.TaggedError(
  "FellowshipLogsAuthorizationCallbackError",
)<{
  readonly reason: keyof typeof FELLOWSHIP_LOGS_AUTHORIZATION_CALLBACK_REASON_DESCRIPTIONS;
}> {
  override get message() {
    return FELLOWSHIP_LOGS_AUTHORIZATION_CALLBACK_REASON_DESCRIPTIONS[
      this.reason
    ];
  }
}

const FELLOWSHIP_LOGS_AUTHORIZATION_SETTING_DESCRIPTIONS = {
  ClientId: "Fellowship Run Tracker client ID",
} as const;

export class FellowshipLogsAuthorizationNotConfiguredError extends Data.TaggedError(
  "FellowshipLogsAuthorizationNotConfiguredError",
)<{
  readonly setting: keyof typeof FELLOWSHIP_LOGS_AUTHORIZATION_SETTING_DESCRIPTIONS;
}> {
  override get message() {
    return `Fellowship Logs authorization requires a configured ${FELLOWSHIP_LOGS_AUTHORIZATION_SETTING_DESCRIPTIONS[this.setting]}.`;
  }
}
