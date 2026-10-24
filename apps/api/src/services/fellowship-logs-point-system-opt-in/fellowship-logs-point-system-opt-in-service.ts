import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import {
  type FellowshipLogsGatewayGraphQLResponseError,
  FellowshipLogsGatewayRateLimitExceededError,
  type FellowshipLogsGatewayRateLimitRejectedError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { NodeHttpClientLayer } from "@frt/api/layers/node-platform-layer.ts";
import { classifyFellowshipLogsPointPolicyErrors } from "@frt/api/services/fellowship-logs-gateway/classify-fellowship-logs-point-policy-errors.ts";
import {
  type FellowshipLogsGatewayAccessSource,
  makeConnectionGatewayAccessSource,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-access.ts";
import { makeFellowshipLogsGatewayHttpQuery } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-http-query.ts";
import { FellowshipLogsGatewayRequestPacer } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-request-pacer.ts";
import { getGraphQLResponseData } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-response-helpers.ts";
import { makeQuery } from "@frt/api/services/fellowship-logs-gateway/query/make-query.ts";
import { type FellowshipLogsGatewayQueryError } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-graphql-schema.ts";

export type FellowshipLogsPointSystemOptInResult =
  | "NOT_REQUIRED"
  | "OPT_IN_REQUIRED"
  | "OPTED_IN";

export type CheckPointSystemOptInError =
  | Exclude<
      FellowshipLogsGatewayQueryError,
      FellowshipLogsGatewayRateLimitRejectedError
    >
  | FellowshipLogsGatewayGraphQLResponseError
  | FellowshipLogsGatewayRateLimitExceededError;

const REJECTED_CHECK_RETRY_DELAY = { minutes: 5 } as const;

export type FellowshipLogsPointSystemOptInShape = {
  readonly check: () => E.Effect<
    FellowshipLogsPointSystemOptInResult,
    CheckPointSystemOptInError
  >;
};

const POINT_SYSTEM_OPT_IN_CHECK_QUERY = makeQuery({
  capability: "USER_POINT_ELIGIBLE",
  name: "CheckPointSystemOptIn",
  selections: ["rateLimitData { currentRequest }"],
});

const PointSystemOptInCheckResponseDataSchema = Schema.Struct({
  rateLimitData: Schema.Struct({
    currentRequest: Schema.Unknown,
  }),
});

const makeFellowshipLogsPointSystemOptIn = E.gen(function* () {
  const accessSource = yield* makeConnectionGatewayAccessSource({
    refuseWithoutPointSystemOptIn: false,
  });
  const leasedAccessSource: FellowshipLogsGatewayAccessSource = {
    ...accessSource,
    withRequest: (effect) => effect,
  };
  const query = yield* makeFellowshipLogsGatewayHttpQuery(leasedAccessSource);

  const check: FellowshipLogsPointSystemOptInShape["check"] = E.fn(
    "FellowshipLogsPointSystemOptIn.check",
  )(
    function* () {
      const access = yield* accessSource.get();

      if (access.profile !== "FELLOWSHIP_RUN_TRACKER_USER") {
        return "NOT_REQUIRED" as const;
      }

      const response = yield* query(
        { query: POINT_SYSTEM_OPT_IN_CHECK_QUERY },
        PointSystemOptInCheckResponseDataSchema,
      ).pipe(
        E.catchTag("FellowshipLogsGatewayRateLimitRejectedError", () => {
          return DateTime.now.pipe(
            E.flatMap((now) => {
              return E.fail(
                new FellowshipLogsGatewayRateLimitExceededError({
                  reason: "UserPointsRejectedByApi",
                  resetsAt: DateTime.add(now, REJECTED_CHECK_RETRY_DELAY),
                }),
              );
            }),
          );
        }),
      );

      if (
        Option.contains(
          classifyFellowshipLogsPointPolicyErrors(response.errors),
          "PointSystemOptInRequired",
        )
      ) {
        return "OPT_IN_REQUIRED" as const;
      }

      yield* getGraphQLResponseData(response);

      if (access.connectedUserId !== null) {
        yield* accessSource.reportPointSystemOptIn({
          connectedUserId: access.connectedUserId,
          required: false,
        });
      }

      return "OPTED_IN" as const;
    },
    (effect) => accessSource.withRequest(effect),
  );

  return {
    check,
  } satisfies FellowshipLogsPointSystemOptInShape;
});

export class FellowshipLogsPointSystemOptIn extends Context.Service<
  FellowshipLogsPointSystemOptIn,
  FellowshipLogsPointSystemOptInShape
>()(
  "@frt/api/services/fellowship-logs-point-system-opt-in/fellowship-logs-point-system-opt-in-service/FellowshipLogsPointSystemOptIn",
) {
  static readonly layerNoDeps = Layer.effect(
    this,
    makeFellowshipLogsPointSystemOptIn,
  );

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(FellowshipLogsGatewayRequestPacer.layer),
    Layer.provide(NodeHttpClientLayer),
  );
}
