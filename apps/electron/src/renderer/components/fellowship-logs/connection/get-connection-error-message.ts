import * as Schema from "effect/Schema";

import {
  FellowshipLogsApiAuthorizationCallbackInvalidError,
  FellowshipLogsApiAuthorizationFailedError,
  FellowshipLogsApiAuthorizationNotConfiguredError,
  FellowshipLogsApiAuthorizationNotPendingError,
  FellowshipLogsApiConnectionChangedError,
  FellowshipLogsApiConnectionReplacementConfirmationRequiredError,
  FellowshipLogsApiConnectionRequiredError,
  FellowshipLogsApiInvalidCredentialsError,
  FellowshipLogsApiLocalProtectionAcknowledgementRequiredError,
  FellowshipLogsApiPointSystemOptInRequiredError,
  FellowshipLogsApiRateLimitExceededError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";

const DISPLAY_SAFE_ERRORS = [
  FellowshipLogsApiAuthorizationCallbackInvalidError,
  FellowshipLogsApiAuthorizationFailedError,
  FellowshipLogsApiAuthorizationNotConfiguredError,
  FellowshipLogsApiAuthorizationNotPendingError,
  FellowshipLogsApiConnectionChangedError,
  FellowshipLogsApiConnectionRequiredError,
  FellowshipLogsApiInvalidCredentialsError,
  FellowshipLogsApiPointSystemOptInRequiredError,
  FellowshipLogsApiRateLimitExceededError,
].map((errorClass) => Schema.is(errorClass));

export const isLocalProtectionAcknowledgementRequired = Schema.is(
  FellowshipLogsApiLocalProtectionAcknowledgementRequiredError,
);

export const isReplacementConfirmationRequired = Schema.is(
  FellowshipLogsApiConnectionReplacementConfirmationRequiredError,
);

export function getConnectionErrorMessage(error: unknown): string {
  return DISPLAY_SAFE_ERRORS.some((isError) => isError(error)) &&
    error instanceof Error
    ? error.message
    : "Something went wrong. Try again.";
}
