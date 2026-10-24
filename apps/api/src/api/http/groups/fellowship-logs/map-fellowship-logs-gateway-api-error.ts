import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as Match from "effect/Match";

import {
  type FellowshipLogsGatewayAccessError,
  type FellowshipLogsGatewayGraphQLResponseError,
  type FellowshipLogsGatewayPointPolicyErrorReason,
  type FellowshipLogsGatewayRateLimitExceededErrorReason,
  type FellowshipLogsGatewayRateLimitRejectedError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { type FellowshipLogsGatewayRequestOperationError } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import {
  FellowshipLogsApiConnectionRequiredError,
  FellowshipLogsApiLocalProtectionAcknowledgementRequiredError,
  FellowshipLogsApiOperationUnavailableError,
  FellowshipLogsApiPointSystemOptInRequiredError,
  FellowshipLogsApiRateLimitExceededError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";

type FellowshipLogsGatewayApiSourceError =
  | FellowshipLogsGatewayGraphQLResponseError
  | FellowshipLogsGatewayRateLimitRejectedError
  | FellowshipLogsGatewayRequestOperationError;

export type FellowshipLogsGatewayApiError =
  | FellowshipLogsApiConnectionRequiredError
  | FellowshipLogsApiLocalProtectionAcknowledgementRequiredError
  | FellowshipLogsApiOperationUnavailableError
  | FellowshipLogsApiPointSystemOptInRequiredError
  | FellowshipLogsApiRateLimitExceededError
  | HttpApiError.InternalServerError;

const RATE_LIMIT_REASONS = {
  ApplicationHoldUnavailable: "SHARED_APPLICATION_CAPACITY_UNAVAILABLE",
  PreflightExhausted: "APPLICATION_POINTS_EXHAUSTED",
  RejectedByApi: "APPLICATION_POINTS_EXHAUSTED",
  UserPointsExhausted: "USER_POINTS_EXHAUSTED",
  UserPointsRejectedByApi: "USER_POINTS_EXHAUSTED",
} as const satisfies Record<
  FellowshipLogsGatewayRateLimitExceededErrorReason,
  FellowshipLogsApiRateLimitExceededError["reason"]
>;

const OPERATION_UNAVAILABLE_REASONS = {
  NonUserPointsRequired: "NON_USER_POINTS_REQUIRED",
  NotUserEligible: "NOT_USER_ELIGIBLE",
} as const satisfies Record<
  Exclude<
    FellowshipLogsGatewayPointPolicyErrorReason,
    "DirectiveNotApplicable" | "PointSystemOptInRequired"
  >,
  FellowshipLogsApiOperationUnavailableError["reason"]
>;

const logGatewayFailure = E.fnUntraced(function* (
  error: FellowshipLogsGatewayApiSourceError,
) {
  yield* E.logWarning("Fellowship Logs request failed.", {
    errorTag: error._tag,
    message: error.message,
  });

  return yield* new HttpApiError.InternalServerError();
});

function mapAccessError(
  error: FellowshipLogsGatewayAccessError,
): E.Effect<
  never,
  | FellowshipLogsApiConnectionRequiredError
  | FellowshipLogsApiLocalProtectionAcknowledgementRequiredError
  | HttpApiError.InternalServerError
> {
  return Match.value(error.reason).pipe(
    Match.when("ConnectionChanged", () => logGatewayFailure(error)),
    Match.when("LocalProtectionAcknowledgementRequired", () =>
      E.fail(
        new FellowshipLogsApiLocalProtectionAcknowledgementRequiredError(),
      ),
    ),
    Match.when("NotConnected", () =>
      E.fail(
        new FellowshipLogsApiConnectionRequiredError({
          reason: "NOT_CONNECTED",
        }),
      ),
    ),
    Match.when("ReauthorizationRequired", () =>
      E.fail(
        new FellowshipLogsApiConnectionRequiredError({
          reason: "REAUTHORIZATION_REQUIRED",
        }),
      ),
    ),
    Match.exhaustive,
  );
}

export function mapFellowshipLogsGatewayApiError(
  error: FellowshipLogsGatewayApiSourceError,
): E.Effect<never, FellowshipLogsGatewayApiError> {
  return Match.value(error).pipe(
    Match.tagsExhaustive({
      FellowshipLogsGatewayAccessError: mapAccessError,
      FellowshipLogsGatewayGraphQLResponseError: logGatewayFailure,
      FellowshipLogsGatewayPointPolicyError: (policyError) =>
        Match.value(policyError.reason).pipe(
          Match.when("DirectiveNotApplicable", () =>
            logGatewayFailure(policyError),
          ),
          Match.when("PointSystemOptInRequired", () =>
            E.fail(new FellowshipLogsApiPointSystemOptInRequiredError()),
          ),
          Match.orElse((reason) =>
            E.fail(
              new FellowshipLogsApiOperationUnavailableError({
                reason: OPERATION_UNAVAILABLE_REASONS[reason],
              }),
            ),
          ),
        ),
      FellowshipLogsGatewayRateLimitExceededError: (rateLimitError) =>
        E.fail(
          new FellowshipLogsApiRateLimitExceededError({
            reason: RATE_LIMIT_REASONS[rateLimitError.reason],
            resetsAtMilliseconds: DateTime.toEpochMillis(
              rateLimitError.resetsAt,
            ),
          }),
        ),
      FellowshipLogsGatewayRateLimitRejectedError: logGatewayFailure,
      FellowshipLogsGatewayReportChangedError: logGatewayFailure,
      FellowshipLogsGatewayRequestError: logGatewayFailure,
    }),
  );
}
