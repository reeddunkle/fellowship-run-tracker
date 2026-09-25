import * as Clock from "effect/Clock";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as SynchronizedRef from "effect/SynchronizedRef";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";

import {
  FellowshipLogsGatewayRateLimitRejectedError,
  FellowshipLogsGatewayRequestError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import {
  type CachedAccessToken,
  type FellowshipLogsGatewayCredentials,
  type GetCredentials,
  type Query,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import { makeRequestPacer } from "@frt/api/services/fellowship-logs-gateway/make-request-pacer.ts";
import {
  FellowshipLogsGatewayGraphQLRequestSchema,
  makeFellowshipLogsGatewayGraphQLResponseSchema,
} from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-graphql-schema.ts";
import {
  type FellowshipLogsGatewayAccessToken,
  FellowshipLogsGatewayOAuthTokenResponseSchema,
} from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-oauth-schema.ts";

const FELLOWSHIP_LOGS_CLIENT_API_URL =
  "https://www.fellowshiplogs.com/api/v2/client";

const FELLOWSHIP_LOGS_TOKEN_URL = "https://www.fellowshiplogs.com/oauth/token";

const ACCESS_TOKEN_EXPIRATION_BUFFER_MILLISECONDS = 30_000;

const MIN_QUERY_INTERVAL = "500 millis";

const TOO_MANY_REQUESTS_STATUS = 429;

export function makeFellowshipLogsGatewayHttpQuery(
  getCredentials: GetCredentials,
): E.Effect<Query, never, HttpClient.HttpClient> {
  return E.gen(function* () {
    const baseHttpClient = yield* HttpClient.HttpClient;
    const httpClient = baseHttpClient.pipe(HttpClient.filterStatusOk);
    const pace = yield* makeRequestPacer(MIN_QUERY_INTERVAL);

    const accessTokenRef = yield* SynchronizedRef.make<
      Option.Option<CachedAccessToken>
    >(Option.none());

    const requestAccessToken = E.fn("FellowshipLogsGateway.requestAccessToken")(
      function* (credentials: FellowshipLogsGatewayCredentials) {
        const request = HttpClientRequest.post(FELLOWSHIP_LOGS_TOKEN_URL).pipe(
          HttpClientRequest.basicAuth(
            credentials.clientId,
            credentials.clientSecret,
          ),
          HttpClientRequest.bodyUrlParams({
            grant_type: "client_credentials",
          }),
        );

        const response = yield* httpClient.execute(request);

        const tokenResponse = yield* HttpClientResponse.schemaBodyJson(
          FellowshipLogsGatewayOAuthTokenResponseSchema,
        )(response);

        const nowMilliseconds = yield* Clock.currentTimeMillis;

        return {
          accessToken: tokenResponse.access_token,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          expiresAtMilliseconds:
            nowMilliseconds + tokenResponse.expires_in * 1_000,
        } satisfies CachedAccessToken;
      },
    );

    const getAccessToken = E.fn("FellowshipLogsGateway.getAccessToken")(
      function* () {
        const credentials = yield* getCredentials();
        const nowMilliseconds = yield* Clock.currentTimeMillis;

        const accessToken: FellowshipLogsGatewayAccessToken =
          yield* SynchronizedRef.modifyEffect(
            accessTokenRef,
            (cachedAccessTokenOption) => {
              if (Option.isSome(cachedAccessTokenOption)) {
                const cachedAccessToken = cachedAccessTokenOption.value;

                const credentialsMatch =
                  cachedAccessToken.clientId === credentials.clientId &&
                  cachedAccessToken.clientSecret === credentials.clientSecret;

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

              return requestAccessToken(credentials).pipe(
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

    const query: Query = (request, responseSchema) => {
      return E.gen(function* () {
        const accessToken = yield* getAccessToken();

        const httpRequest = yield* HttpClientRequest.post(
          FELLOWSHIP_LOGS_CLIENT_API_URL,
        ).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.bearerToken(accessToken),
          HttpClientRequest.schemaBodyJson(
            FellowshipLogsGatewayGraphQLRequestSchema,
          )(request),
        );

        const response = yield* pace(baseHttpClient.execute(httpRequest));

        if (response.status === TOO_MANY_REQUESTS_STATUS) {
          return yield* new FellowshipLogsGatewayRateLimitRejectedError();
        }

        const okResponse = yield* HttpClientResponse.filterStatusOk(response);

        return yield* HttpClientResponse.schemaBodyJson(
          makeFellowshipLogsGatewayGraphQLResponseSchema(responseSchema),
        )(okResponse);
      }).pipe(
        E.mapError((error) => {
          if (
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
    };

    return query;
  });
}
