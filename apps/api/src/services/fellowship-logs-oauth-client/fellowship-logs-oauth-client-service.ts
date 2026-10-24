import * as Context from "effect/Context";
import * as E from "effect/Effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { FellowshipLogsOAuthProviderError } from "@frt/api/errors/fellowship-logs-oauth-provider-error.ts";
import { NodeHttpClientLayer } from "@frt/api/layers/node-platform-layer.ts";
import { REQUEST_TIMEOUT } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-http-query.ts";
import { FELLOWSHIP_LOGS_TOKEN_URL } from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-urls.ts";
import { type FellowshipLogsClientId } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  type FellowshipLogsConnectedUserId,
  FellowshipLogsConnectedUserIdSchema,
  type FellowshipLogsConnectedUserName,
  FellowshipLogsConnectedUserNameSchema,
  type FellowshipLogsRedirectUri,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

const FELLOWSHIP_LOGS_USER_API_URL =
  "https://www.fellowshiplogs.com/api/v2/user";
const CURRENT_USER_QUERY =
  "query CurrentUser { userData { currentUser { id name } } }";

const RedactedTokenSchema = Schema.RedactedFromValue(NonEmptyStringSchema);

const TokenResponseSchema = Schema.Struct({
  access_token: RedactedTokenSchema,
  expires_in: PositiveIntegerSchema,
  refresh_token: RedactedTokenSchema,
  token_type: Schema.Literal("Bearer"),
});

const ClientCredentialsTokenResponseSchema = Schema.Struct({
  access_token: RedactedTokenSchema,
  token_type: Schema.Literal("Bearer"),
});

const OAuthErrorResponseSchema = Schema.Struct({
  error: NonEmptyStringSchema,
});

const CurrentUserResponseSchema = Schema.Struct({
  data: Schema.Struct({
    userData: Schema.Struct({
      currentUser: Schema.Struct({
        id: Schema.Int,
        name: FellowshipLogsConnectedUserNameSchema,
      }),
    }),
  }),
});

type FellowshipLogsTokenSet = {
  readonly accessToken: Redacted.Redacted<string>;
  readonly expiresInSeconds: number;
  readonly refreshToken: Redacted.Redacted<string>;
};

type FellowshipLogsCurrentUser = {
  readonly id: FellowshipLogsConnectedUserId;
  readonly name: FellowshipLogsConnectedUserName;
};

type CheckClientCredentialsOptions = {
  readonly clientId: FellowshipLogsClientId;
  readonly clientSecret: Redacted.Redacted<string>;
};

type ExchangeCodeOptions = {
  readonly clientId: FellowshipLogsClientId;
  readonly code: Redacted.Redacted<string>;
  readonly codeVerifier: Redacted.Redacted<string>;
  readonly redirectUri: FellowshipLogsRedirectUri;
};

type RefreshTokensOptions = {
  readonly clientId: FellowshipLogsClientId;
  readonly refreshToken: Redacted.Redacted<string>;
};

export type FellowshipLogsOAuthClientShape = {
  readonly checkClientCredentials: (
    options: CheckClientCredentialsOptions,
  ) => E.Effect<void, FellowshipLogsOAuthProviderError>;
  readonly exchangeCode: (
    options: ExchangeCodeOptions,
  ) => E.Effect<FellowshipLogsTokenSet, FellowshipLogsOAuthProviderError>;
  readonly getCurrentUser: (
    accessToken: Redacted.Redacted<string>,
  ) => E.Effect<FellowshipLogsCurrentUser, FellowshipLogsOAuthProviderError>;
  readonly refreshTokens: (
    options: RefreshTokensOptions,
  ) => E.Effect<FellowshipLogsTokenSet, FellowshipLogsOAuthProviderError>;
};

type ProviderOperation = FellowshipLogsOAuthProviderError["operation"];

const UNAVAILABLE_STATUSES = new Set([408, 429]);

function isUnavailableStatus(status: number) {
  return status >= 500 || UNAVAILABLE_STATUSES.has(status);
}

const makeFellowshipLogsOAuthClient = E.gen(function* () {
  const httpClient = yield* HttpClient.HttpClient;

  const send = (
    operation: ProviderOperation,
    request: HttpClientRequest.HttpClientRequest,
  ) =>
    httpClient.execute(request).pipe(
      E.timeout(REQUEST_TIMEOUT),
      E.mapError(() => {
        return new FellowshipLogsOAuthProviderError({
          operation,
          providerError: null,
          reason: "Unavailable",
          status: null,
        });
      }),
    );

  const decodeOkResponse = <S extends Schema.Constraint>(
    operation: ProviderOperation,
    response: HttpClientResponse.HttpClientResponse,
    schema: S,
  ) =>
    HttpClientResponse.schemaBodyJson(schema)(response).pipe(
      E.timeout(REQUEST_TIMEOUT),
      E.mapError(() => {
        return new FellowshipLogsOAuthProviderError({
          operation,
          providerError: null,
          reason: "UnexpectedResponse",
          status: response.status,
        });
      }),
    );

  const failFromResponse = E.fnUntraced(function* (
    operation: ProviderOperation,
    response: HttpClientResponse.HttpClientResponse,
  ) {
    const providerError = yield* HttpClientResponse.schemaBodyJson(
      OAuthErrorResponseSchema,
    )(response).pipe(
      E.map((body) => body.error),
      E.orElseSucceed(() => null),
    );

    return yield* new FellowshipLogsOAuthProviderError({
      operation,
      providerError,
      reason: isUnavailableStatus(response.status) ? "Unavailable" : "Rejected",
      status: response.status,
    });
  });

  const requestTokens = E.fnUntraced(function* (
    operation: ProviderOperation,
    params: Record<string, string>,
  ) {
    const request = HttpClientRequest.post(FELLOWSHIP_LOGS_TOKEN_URL).pipe(
      HttpClientRequest.acceptJson,
      HttpClientRequest.bodyUrlParams(params),
    );
    const response = yield* send(operation, request);

    if (response.status !== 200) {
      return yield* failFromResponse(operation, response);
    }

    const body = yield* decodeOkResponse(
      operation,
      response,
      TokenResponseSchema,
    );

    return {
      accessToken: body.access_token,
      expiresInSeconds: body.expires_in,
      refreshToken: body.refresh_token,
    } satisfies FellowshipLogsTokenSet;
  });

  const checkClientCredentials: FellowshipLogsOAuthClientShape["checkClientCredentials"] =
    E.fn("FellowshipLogsOAuthClient.checkClientCredentials")(function* ({
      clientId,
      clientSecret,
    }) {
      const request = HttpClientRequest.post(FELLOWSHIP_LOGS_TOKEN_URL).pipe(
        HttpClientRequest.acceptJson,
        HttpClientRequest.basicAuth(clientId, Redacted.value(clientSecret)),
        HttpClientRequest.bodyUrlParams({ grant_type: "client_credentials" }),
      );
      const response = yield* send("CheckClientCredentials", request);

      if (response.status !== 200) {
        return yield* failFromResponse("CheckClientCredentials", response);
      }

      yield* decodeOkResponse(
        "CheckClientCredentials",
        response,
        ClientCredentialsTokenResponseSchema,
      );
    });

  const exchangeCode: FellowshipLogsOAuthClientShape["exchangeCode"] = E.fn(
    "FellowshipLogsOAuthClient.exchangeCode",
  )(function* ({ clientId, code, codeVerifier, redirectUri }) {
    return yield* requestTokens("ExchangeCode", {
      client_id: clientId,
      code: Redacted.value(code),
      code_verifier: Redacted.value(codeVerifier),
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
  });

  const refreshTokens: FellowshipLogsOAuthClientShape["refreshTokens"] = E.fn(
    "FellowshipLogsOAuthClient.refreshTokens",
  )(function* ({ clientId, refreshToken }) {
    return yield* requestTokens("RefreshTokens", {
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: Redacted.value(refreshToken),
    });
  });

  const getCurrentUser: FellowshipLogsOAuthClientShape["getCurrentUser"] = E.fn(
    "FellowshipLogsOAuthClient.getCurrentUser",
  )(function* (accessToken) {
    const request = yield* HttpClientRequest.post(
      FELLOWSHIP_LOGS_USER_API_URL,
    ).pipe(
      HttpClientRequest.acceptJson,
      HttpClientRequest.bearerToken(accessToken),
      HttpClientRequest.bodyJson({ query: CURRENT_USER_QUERY }),
      E.mapError(() => {
        return new FellowshipLogsOAuthProviderError({
          operation: "GetCurrentUser",
          providerError: null,
          reason: "UnexpectedResponse",
          status: null,
        });
      }),
    );
    const response = yield* send("GetCurrentUser", request);

    if (response.status !== 200) {
      return yield* failFromResponse("GetCurrentUser", response);
    }

    const body = yield* decodeOkResponse(
      "GetCurrentUser",
      response,
      CurrentUserResponseSchema,
    );
    const { currentUser } = body.data.userData;

    return {
      id: FellowshipLogsConnectedUserIdSchema.make(String(currentUser.id)),
      name: currentUser.name,
    };
  });

  return {
    checkClientCredentials,
    exchangeCode,
    getCurrentUser,
    refreshTokens,
  } satisfies FellowshipLogsOAuthClientShape;
});

export class FellowshipLogsOAuthClient extends Context.Service<
  FellowshipLogsOAuthClient,
  FellowshipLogsOAuthClientShape
>()(
  "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-client-service/FellowshipLogsOAuthClient",
) {
  static readonly layerNoDeps = Layer.effect(
    this,
    makeFellowshipLogsOAuthClient,
  );

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(NodeHttpClientLayer),
  );
}
