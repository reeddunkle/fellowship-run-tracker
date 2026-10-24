import * as E from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipLogsOAuthClient } from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-client-service.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import { FellowshipLogsRedirectUriSchema } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const CLIENT_ID = Schema.decodeSync(FellowshipLogsClientIdSchema)("client-id");
const REDIRECT_URI = Schema.decodeSync(FellowshipLogsRedirectUriSchema)(
  "http://127.0.0.1:51234/oauth/callback",
);

const TOKEN_RESPONSE = {
  access_token: "access-token-value",
  expires_in: 31_104_000,
  refresh_token: "refresh-token-value",
  token_type: "Bearer",
};

type RecordedRequest = {
  readonly authorization: string | undefined;
  readonly body: string;
  readonly url: string;
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function readBody(request: HttpClientRequest.HttpClientRequest) {
  return request.body._tag === "Uint8Array" ? (request.body.text ?? "") : "";
}

function makeTestLayer(respond: (url: URL) => Response) {
  const requests: Array<RecordedRequest> = [];
  const StubHttpClientLayer = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      requests.push({
        authorization: request.headers.authorization,
        body: readBody(request),
        url: url.toString(),
      });

      return E.succeed(HttpClientResponse.fromWeb(request, respond(url)));
    }),
  );

  return {
    layer: FellowshipLogsOAuthClient.layerNoDeps.pipe(
      Layer.provide(StubHttpClientLayer),
    ),
    requests,
  };
}

const exchangeCode = E.gen(function* () {
  const client = yield* FellowshipLogsOAuthClient;

  return yield* client.exchangeCode({
    clientId: CLIENT_ID,
    code: Redacted.make("authorization-code"),
    codeVerifier: Redacted.make("code-verifier"),
    redirectUri: REDIRECT_URI,
  });
});

const refreshTokens = E.gen(function* () {
  const client = yield* FellowshipLogsOAuthClient;

  return yield* client.refreshTokens({
    clientId: CLIENT_ID,
    refreshToken: Redacted.make("refresh-token-value"),
  });
});

const getCurrentUser = E.gen(function* () {
  const client = yield* FellowshipLogsOAuthClient;

  return yield* client.getCurrentUser(Redacted.make("access-token-value"));
});

describe("FellowshipLogsOAuthClient", () => {
  test("exchanges a code with the PKCE token request and no client secret", async () => {
    const { layer, requests } = makeTestLayer(() =>
      jsonResponse(200, TOKEN_RESPONSE),
    );

    const tokens = await exchangeCode.pipe(E.provide(layer), runTest);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://www.fellowshiplogs.com/oauth/token");
    expect(requests[0]?.authorization).toBeUndefined();
    expect(
      Object.fromEntries(new URLSearchParams(requests[0]?.body ?? "")),
    ).toEqual({
      client_id: CLIENT_ID,
      code: "authorization-code",
      code_verifier: "code-verifier",
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    });
    expect(Redacted.value(tokens.accessToken)).toBe("access-token-value");
    expect(Redacted.value(tokens.refreshToken)).toBe("refresh-token-value");
    expect(tokens.expiresInSeconds).toBe(31_104_000);
  });

  test("classifies a rejected code with the provider error code only", async () => {
    const { layer } = makeTestLayer(() =>
      jsonResponse(400, {
        error: "invalid_grant",
        error_description: "The provided authorization grant is invalid.",
        hint: "Authorization code has been revoked",
      }),
    );

    const error = await exchangeCode.pipe(E.flip, E.provide(layer), runTest);

    expect(error).toMatchObject({
      _tag: "FellowshipLogsOAuthProviderError",
      operation: "ExchangeCode",
      providerError: "invalid_grant",
      reason: "Rejected",
      status: 400,
    });
  });

  test("classifies a server error as unavailable", async () => {
    const { layer } = makeTestLayer(
      () => new Response("down", { status: 503 }),
    );

    const error = await exchangeCode.pipe(E.flip, E.provide(layer), runTest);

    expect(error).toMatchObject({
      providerError: null,
      reason: "Unavailable",
      status: 503,
    });
  });

  test("classifies a token response without a refresh token as unexpected", async () => {
    const { layer } = makeTestLayer(() =>
      jsonResponse(200, { ...TOKEN_RESPONSE, refresh_token: undefined }),
    );

    const error = await exchangeCode.pipe(E.flip, E.provide(layer), runTest);

    expect(error).toMatchObject({
      reason: "UnexpectedResponse",
      status: 200,
    });
    expect(JSON.stringify(error)).not.toContain("access-token-value");
  });

  test("refreshes with only the client ID and refresh token", async () => {
    const { layer, requests } = makeTestLayer(() =>
      jsonResponse(200, {
        ...TOKEN_RESPONSE,
        access_token: "rotated-access-token",
        refresh_token: "rotated-refresh-token",
      }),
    );

    const tokens = await refreshTokens.pipe(E.provide(layer), runTest);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://www.fellowshiplogs.com/oauth/token");
    expect(requests[0]?.authorization).toBeUndefined();
    expect(
      Object.fromEntries(new URLSearchParams(requests[0]?.body ?? "")),
    ).toEqual({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: "refresh-token-value",
    });
    expect(Redacted.value(tokens.accessToken)).toBe("rotated-access-token");
    expect(Redacted.value(tokens.refreshToken)).toBe("rotated-refresh-token");
  });

  test("classifies a reused refresh token as an invalid grant", async () => {
    const { layer } = makeTestLayer(() =>
      jsonResponse(400, {
        error: "invalid_grant",
        error_description: "The refresh token is invalid.",
        hint: "Token has been revoked",
      }),
    );

    const error = await refreshTokens.pipe(E.flip, E.provide(layer), runTest);

    expect(error).toMatchObject({
      operation: "RefreshTokens",
      providerError: "invalid_grant",
      reason: "Rejected",
      status: 400,
    });
    expect(JSON.stringify(error)).not.toContain("refresh-token-value");
  });

  test("reads the current user with a bearer token and stores the numeric ID as a string", async () => {
    const { layer, requests } = makeTestLayer(() =>
      jsonResponse(200, {
        data: { userData: { currentUser: { id: 12_345, name: "Player" } } },
      }),
    );

    const user = await getCurrentUser.pipe(E.provide(layer), runTest);

    expect(requests[0]?.url).toBe("https://www.fellowshiplogs.com/api/v2/user");
    expect(requests[0]?.authorization).toBe("Bearer access-token-value");
    expect(user).toEqual({ id: "12345", name: "Player" });
  });

  test("classifies an unauthorized user request as rejected", async () => {
    const { layer } = makeTestLayer(() => new Response("", { status: 401 }));

    const error = await getCurrentUser.pipe(E.flip, E.provide(layer), runTest);

    expect(error).toMatchObject({
      operation: "GetCurrentUser",
      reason: "Rejected",
      status: 401,
    });
  });

  test("classifies a missing current user as unexpected", async () => {
    const { layer } = makeTestLayer(() =>
      jsonResponse(200, { data: { userData: { currentUser: null } } }),
    );

    const error = await getCurrentUser.pipe(E.flip, E.provide(layer), runTest);

    expect(error).toMatchObject({ reason: "UnexpectedResponse" });
  });
});
