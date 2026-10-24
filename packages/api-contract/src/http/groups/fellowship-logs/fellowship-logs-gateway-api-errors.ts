import * as HttpApiError from "effect/http-api/HttpApiError";

import {
  FellowshipLogsApiConnectionRequiredError,
  FellowshipLogsApiLocalProtectionAcknowledgementRequiredError,
  FellowshipLogsApiOperationUnavailableError,
  FellowshipLogsApiPointSystemOptInRequiredError,
  FellowshipLogsApiRateLimitExceededError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";

export const FellowshipLogsGatewayApiErrors = [
  FellowshipLogsApiConnectionRequiredError,
  FellowshipLogsApiLocalProtectionAcknowledgementRequiredError,
  FellowshipLogsApiOperationUnavailableError,
  FellowshipLogsApiPointSystemOptInRequiredError,
  FellowshipLogsApiRateLimitExceededError,
  HttpApiError.InternalServerErrorNoContent,
];
