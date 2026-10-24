import * as Clock from "effect/Clock";
import * as E from "effect/Effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import type * as Schema from "effect/Schema";
import * as SynchronizedRef from "effect/SynchronizedRef";

import {
  FellowshipLogsGatewayAccessError,
  FellowshipLogsGatewayPointPolicyError,
  FellowshipLogsGatewayRateLimitRejectedError,
  FellowshipLogsGatewayRequestError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { classifyFellowshipLogsPointPolicyErrors } from "@frt/api/services/fellowship-logs-gateway/classify-fellowship-logs-point-policy-errors.ts";
import {
  type FellowshipLogsGatewayAccess,
  type FellowshipLogsGatewayAccessSource,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-access.ts";
import {
  FELLOWSHIP_LOGS_GATEWAY_ENDPOINT_URLS,
  getFellowshipLogsGatewayRequestPolicy,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-point-policy.ts";
import { FellowshipLogsGatewayRequestPacer } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-request-pacer.ts";
import {
  applyQuerySpending,
  type FellowshipLogsGatewayQuery,
} from "@frt/api/services/fellowship-logs-gateway/query/make-query.ts";
import {
  type FellowshipLogsGatewayGraphQLRequest,
  FellowshipLogsGatewayGraphQLWireRequestSchema,
  makeFellowshipLogsGatewayGraphQLResponseSchema,
  type Query,
} from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-graphql-schema.ts";
import {
  type FellowshipLogsGatewayAccessToken,
  FellowshipLogsGatewayOAuthTokenResponseSchema,
} from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-oauth-schema.ts";
import { FELLOWSHIP_LOGS_TOKEN_URL } from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-urls.ts";

const ACCESS_TOKEN_EXPIRATION_BUFFER_MILLISECONDS = 30_000;

export const REQUEST_TIMEOUT = "30 seconds";

const UNAUTHORIZED_STATUS = 401;

const TOO_MANY_REQUESTS_STATUS = 429;

const ACCESS_TOKEN_REPLACED = "ACCESS_TOKEN_REPLACED" as const;

function checkUserPointEligibility(query: FellowshipLogsGatewayQuery) {
  return query.capability === "USER_POINT_ELIGIBLE"
    ? E.void
    : E.fail(
        new FellowshipLogsGatewayPointPolicyError({
          reason: "NotUserEligible",
        }),
      );
}

type ClientCredentialsAccess = Extract<
  FellowshipLogsGatewayAccess,
  { readonly profile: "OWN_CLIENT" }
>;

type CachedClientAccessToken = {
  readonly accessToken: FellowshipLogsGatewayAccessToken;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly expiresAtMilliseconds: number;
};

export const makeFellowshipLogsGatewayHttpQuery: (
  accessSource: FellowshipLogsGatewayAccessSource,
) => E.Effect<
  Query,
  never,
  FellowshipLogsGatewayRequestPacer | HttpClient.HttpClient
> = E.fnUntraced(function* (accessSource) {
  const baseHttpClient = yield* HttpClient.HttpClient;
  const httpClient = baseHttpClient.pipe(HttpClient.filterStatusOk);
  const { pace } = yield* FellowshipLogsGatewayRequestPacer;

  const clientAccessTokenRef = yield* SynchronizedRef.make<
    Option.Option<CachedClientAccessToken>
  >(Option.none());

  const requestClientAccessToken = E.fn(
    "FellowshipLogsGateway.requestAccessToken",
  )(function* (access: ClientCredentialsAccess) {
    const request = HttpClientRequest.post(FELLOWSHIP_LOGS_TOKEN_URL).pipe(
      HttpClientRequest.basicAuth(
        access.clientId,
        Redacted.value(access.clientSecret),
      ),
      HttpClientRequest.bodyUrlParams({
        grant_type: "client_credentials",
      }),
    );

    const tokenResponse = yield* httpClient
      .execute(request)
      .pipe(
        E.flatMap(
          HttpClientResponse.schemaBodyJson(
            FellowshipLogsGatewayOAuthTokenResponseSchema,
          ),
        ),
        E.timeout(REQUEST_TIMEOUT),
      );

    const nowMilliseconds = yield* Clock.currentTimeMillis;

    return {
      accessToken: tokenResponse.access_token,
      clientId: access.clientId,
      clientSecret: Redacted.value(access.clientSecret),
      expiresAtMilliseconds: nowMilliseconds + tokenResponse.expires_in * 1_000,
    } satisfies CachedClientAccessToken;
  });

  const getClientAccessToken = E.fn("FellowshipLogsGateway.getAccessToken")(
    function* (access: ClientCredentialsAccess) {
      const nowMilliseconds = yield* Clock.currentTimeMillis;

      const accessToken: FellowshipLogsGatewayAccessToken =
        yield* SynchronizedRef.modifyEffect(
          clientAccessTokenRef,
          (cachedAccessTokenOption) => {
            if (Option.isSome(cachedAccessTokenOption)) {
              const cachedAccessToken = cachedAccessTokenOption.value;

              const credentialsMatch =
                cachedAccessToken.clientId === access.clientId &&
                cachedAccessToken.clientSecret ===
                  Redacted.value(access.clientSecret);

              const isValid =
                cachedAccessToken.expiresAtMilliseconds -
                  ACCESS_TOKEN_EXPIRATION_BUFFER_MILLISECONDS >
                nowMilliseconds;

              if (credentialsMatch && isValid) {
                return E.succeed([
                  cachedAccessToken.accessToken,
                  cachedAccessTokenOption,
                ] as const);
              }
            }

            return requestClientAccessToken(access).pipe(
              E.map((cachedAccessToken) => {
                return [
                  cachedAccessToken.accessToken,
                  Option.some(cachedAccessToken),
                ] as const;
              }),
            );
          },
        );

      return accessToken;
    },
  );

  const getBearerToken = (access: FellowshipLogsGatewayAccess) => {
    return access.profile === "OWN_CLIENT"
      ? getClientAccessToken(access)
      : E.succeed(access.accessToken);
  };

  const execute = E.fnUntraced(function* <ResponseData>(
    request: FellowshipLogsGatewayGraphQLRequest,
    responseSchema: Schema.Decoder<ResponseData, never>,
  ) {
    const access = yield* accessSource.get();
    const policy = getFellowshipLogsGatewayRequestPolicy(access.profile);

    if (policy.spending === "USER_POINTS_ONLY") {
      yield* checkUserPointEligibility(request.query);
    }

    const query = yield* applyQuerySpending(
      request.query,
      policy.spending,
    ).pipe(
      E.fromOption,
      E.mapError(() => {
        return new FellowshipLogsGatewayPointPolicyError({
          reason: "DirectiveNotApplicable",
        });
      }),
    );

    const bearerToken = yield* getBearerToken(access);

    const httpRequest = yield* HttpClientRequest.post(
      FELLOWSHIP_LOGS_GATEWAY_ENDPOINT_URLS[policy.endpoint],
    ).pipe(
      HttpClientRequest.acceptJson,
      HttpClientRequest.bearerToken(bearerToken),
      HttpClientRequest.schemaBodyJson(
        FellowshipLogsGatewayGraphQLWireRequestSchema,
      )({ ...request, query }),
    );

    const response = yield* pace(
      baseHttpClient.execute(httpRequest).pipe(E.timeout(REQUEST_TIMEOUT)),
    );

    if (
      response.status === UNAUTHORIZED_STATUS &&
      access.profile !== "OWN_CLIENT"
    ) {
      yield* accessSource.reportRejected(access.accessToken);

      return ACCESS_TOKEN_REPLACED;
    }

    if (response.status === TOO_MANY_REQUESTS_STATUS) {
      return yield* new FellowshipLogsGatewayRateLimitRejectedError();
    }

    const okResponse = yield* HttpClientResponse.filterStatusOk(response);

    const graphQLResponse = yield* HttpClientResponse.schemaBodyJson(
      makeFellowshipLogsGatewayGraphQLResponseSchema(responseSchema),
    )(okResponse).pipe(E.timeout(REQUEST_TIMEOUT));

    const pointPolicyErrorReason = classifyFellowshipLogsPointPolicyErrors(
      graphQLResponse.errors,
    );

    if (
      access.profile !== "OWN_CLIENT" &&
      access.connectedUserId !== null &&
      Option.contains(pointPolicyErrorReason, "PointSystemOptInRequired")
    ) {
      yield* accessSource.reportPointSystemOptIn({
        connectedUserId: access.connectedUserId,
        required: true,
      });
    }

    return graphQLResponse;
  });

  const query: Query = E.fn("FellowshipLogsGateway.query")(
    function* (request, responseSchema) {
      const response = yield* execute(request, responseSchema);

      if (response !== ACCESS_TOKEN_REPLACED) {
        return response;
      }

      const retriedResponse = yield* execute(request, responseSchema);

      if (retriedResponse === ACCESS_TOKEN_REPLACED) {
        return yield* new FellowshipLogsGatewayAccessError({
          cause: null,
          reason: "ReauthorizationRequired",
        });
      }

      return retriedResponse;
    },
    (effect) => {
      return accessSource.withRequest(effect);
    },
    E.mapError((error) => {
      if (
        error instanceof FellowshipLogsGatewayAccessError ||
        error instanceof FellowshipLogsGatewayPointPolicyError ||
        error instanceof FellowshipLogsGatewayRequestError ||
        error instanceof FellowshipLogsGatewayRateLimitRejectedError
      ) {
        return error;
      }

      return new FellowshipLogsGatewayRequestError({
        cause: error,
        operation: "Query",
      });
    }),
  );

  return query;
});
