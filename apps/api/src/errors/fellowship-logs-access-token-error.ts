import * as Data from "effect/Data";

import { type FellowshipLogsAuthorizedProfile } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const FELLOWSHIP_LOGS_NO_SIGNED_IN_SESSION_REASON_DESCRIPTIONS = {
  ClientSecretConnection:
    "The active Fellowship Logs connection uses a client secret, not a signed-in session.",
  NotConnected: "Fellowship Logs is not connected.",
} as const;

export class FellowshipLogsNoSignedInSessionError extends Data.TaggedError(
  "FellowshipLogsNoSignedInSessionError",
)<{
  readonly reason: keyof typeof FELLOWSHIP_LOGS_NO_SIGNED_IN_SESSION_REASON_DESCRIPTIONS;
}> {
  override get message() {
    return FELLOWSHIP_LOGS_NO_SIGNED_IN_SESSION_REASON_DESCRIPTIONS[
      this.reason
    ];
  }
}

const FELLOWSHIP_LOGS_REAUTHORIZATION_REASON_DESCRIPTIONS = {
  AccessTokenRejected: "Fellowship Logs rejected the current access token",
  NoRefreshToken: "the session has no refresh token",
  PreviouslyRequired: "the session already required reauthorization",
  RefreshTokenRejected: "Fellowship Logs rejected the refresh token",
} as const;

export class FellowshipLogsReauthorizationRequiredError extends Data.TaggedError(
  "FellowshipLogsReauthorizationRequiredError",
)<{
  readonly profile: FellowshipLogsAuthorizedProfile;
  readonly reason: keyof typeof FELLOWSHIP_LOGS_REAUTHORIZATION_REASON_DESCRIPTIONS;
}> {
  override get message() {
    return `Sign in to Fellowship Logs again: ${FELLOWSHIP_LOGS_REAUTHORIZATION_REASON_DESCRIPTIONS[this.reason]}.`;
  }
}
