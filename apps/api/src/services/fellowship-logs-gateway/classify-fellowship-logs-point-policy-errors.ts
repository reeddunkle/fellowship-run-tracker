import * as Option from "effect/Option";

import { type FellowshipLogsGatewayPointPolicyErrorReason } from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { type FellowshipLogsGatewayGraphQLError } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-graphql-schema.ts";

const POINT_POLICY_ERROR_MESSAGES = [
  [
    "cannot require only user points be spent without authenticating a user and opting into the new point system",
    "PointSystemOptInRequired",
  ],
  [
    "attempted to spend non-user points while the @onlySpendUserPoints directive was enabled",
    "NonUserPointsRequired",
  ],
] as const satisfies ReadonlyArray<
  readonly [string, FellowshipLogsGatewayPointPolicyErrorReason]
>;

export function classifyFellowshipLogsPointPolicyErrors(
  errors: ReadonlyArray<FellowshipLogsGatewayGraphQLError> | undefined,
): Option.Option<FellowshipLogsGatewayPointPolicyErrorReason> {
  const reason = POINT_POLICY_ERROR_MESSAGES.find(([message]) => {
    return (errors ?? []).some((error) => {
      return error.message.includes(message);
    });
  })?.[1];

  return Option.fromUndefinedOr(reason);
}
