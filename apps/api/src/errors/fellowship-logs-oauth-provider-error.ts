import * as Data from "effect/Data";

const FELLOWSHIP_LOGS_OAUTH_PROVIDER_OPERATION_DESCRIPTIONS = {
  CheckClientCredentials: "check the Fellowship Logs client credentials",
  ExchangeCode: "exchange the Fellowship Logs authorization code",
  GetCurrentUser: "read the connected Fellowship Logs user",
  RefreshTokens: "refresh the Fellowship Logs session",
} as const;

const FELLOWSHIP_LOGS_OAUTH_PROVIDER_REASON_DESCRIPTIONS = {
  Rejected: "Fellowship Logs rejected the request",
  Unavailable: "Fellowship Logs could not be reached",
  UnexpectedResponse: "Fellowship Logs returned an unexpected response",
} as const;

export class FellowshipLogsOAuthProviderError extends Data.TaggedError(
  "FellowshipLogsOAuthProviderError",
)<{
  readonly operation: keyof typeof FELLOWSHIP_LOGS_OAUTH_PROVIDER_OPERATION_DESCRIPTIONS;
  readonly providerError: string | null;
  readonly reason: keyof typeof FELLOWSHIP_LOGS_OAUTH_PROVIDER_REASON_DESCRIPTIONS;
  readonly status: number | null;
}> {
  override get message() {
    return `Failed to ${FELLOWSHIP_LOGS_OAUTH_PROVIDER_OPERATION_DESCRIPTIONS[this.operation]}: ${FELLOWSHIP_LOGS_OAUTH_PROVIDER_REASON_DESCRIPTIONS[this.reason]}.`;
  }
}
