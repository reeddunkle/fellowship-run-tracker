import * as Clock from "effect/Clock";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as SynchronizedRef from "effect/SynchronizedRef";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";

import { FellowshipLogsRequestError } from "@frt/api/errors/fellowship-logs-error.ts";
import {
  type CachedAccessToken,
  type FellowshipLogsCredentials,
  type GetCredentials,
  type Query,
} from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import {
  FellowshipLogsGraphQLRequestSchema,
  makeFellowshipLogsGraphQLResponseSchema,
} from "@frt/api/services/fellowship-logs/validation/fellowship-logs-graphql-schema.ts";
import {
  type FellowshipLogsAccessToken,
  FellowshipLogsOAuthTokenResponseSchema,
} from "@frt/api/services/fellowship-logs/validation/fellowship-logs-oauth-schema.ts";

const FELLOWSHIP_LOGS_CLIENT_API_URL =
  "https://www.fellowshiplogs.com/api/v2/client";

const FELLOWSHIP_LOGS_TOKEN_URL = "https://www.fellowshiplogs.com/oauth/token";

const ACCESS_TOKEN_EXPIRATION_BUFFER_MILLISECONDS = 30_000;

export function makeFellowshipLogsHttpQuery(
  getCredentials: GetCredentials,
): E.Effect<Query, never, HttpClient.HttpClient> {
  return E.gen(function* () {
    const httpClient = (yield* HttpClient.HttpClient).pipe(
      HttpClient.filterStatusOk,
    );

    const accessTokenRef = yield* SynchronizedRef.make<
      Option.Option<CachedAccessToken>
    >(Option.none());

    const requestAccessToken = E.fn("FellowshipLogs.requestAccessToken")(
      function* (credentials: FellowshipLogsCredentials) {
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
          FellowshipLogsOAuthTokenResponseSchema,
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

    const getAccessToken = E.fn("FellowshipLogs.getAccessToken")(function* () {
      const credentials = yield* getCredentials();
      const nowMilliseconds = yield* Clock.currentTimeMillis;

      const accessToken: FellowshipLogsAccessToken =
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
    });

    const query: Query = (request, responseSchema) => {
      return E.gen(function* () {
        const accessToken = yield* getAccessToken();

        const httpRequest = yield* HttpClientRequest.post(
          FELLOWSHIP_LOGS_CLIENT_API_URL,
        ).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.bearerToken(accessToken),
          HttpClientRequest.schemaBodyJson(FellowshipLogsGraphQLRequestSchema)(
            request,
          ),
        );

        const response = yield* httpClient.execute(httpRequest);

        return yield* HttpClientResponse.schemaBodyJson(
          makeFellowshipLogsGraphQLResponseSchema(responseSchema),
        )(response);
      }).pipe(
        E.mapError((error) => {
          if (error instanceof FellowshipLogsRequestError) {
            return error;
          }

          return new FellowshipLogsRequestError({
            cause: error,
            operation: "Query",
          });
        }),
      );
    };

    return query;
  });
}
