import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Scope from "effect/Scope";
import { describe, expect, test } from "vitest";

import { NodeHttpClientLayer } from "@frt/api/layers/node-platform-layer.ts";
import { listenForAuthorizationCallback } from "@frt/api/services/fellowship-logs-authorization/listen-for-authorization-callback.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

type SentRequest = {
  readonly host?: string;
  readonly method?: "GET" | "POST";
  readonly path: string;
};

const sendRequest = E.fnUntraced(function* (
  redirectUri: string,
  { host, method = "GET", path }: SentRequest,
) {
  const httpClient = yield* HttpClient.HttpClient;
  const request = HttpClientRequest.make(method)(new URL(path, redirectUri));
  const response = yield* httpClient.execute(
    host === undefined
      ? request
      : HttpClientRequest.setHeader(request, "host", host),
  );

  return {
    body: yield* response.text,
    headers: response.headers,
    status: response.status,
  };
});

function runRequest(redirectUri: string, request: SentRequest) {
  return sendRequest(redirectUri, request).pipe(
    E.provide(NodeHttpClientLayer),
    runTest,
  );
}

const listen = E.gen(function* () {
  const callbacks: Array<string> = [];
  const scope = yield* Scope.make();
  const redirectUri = yield* listenForAuthorizationCallback((callbackUrl) => {
    callbacks.push(callbackUrl);
  }).pipe(Scope.provide(scope));

  return { callbacks, redirectUri, scope };
});

describe("listenForAuthorizationCallback", () => {
  test("listens on a 127.0.0.1 ephemeral port at the callback path", async () => {
    const { redirectUri, scope } = await runTest(listen);

    try {
      const url = new URL(redirectUri);

      expect(url.protocol).toBe("http:");
      expect(url.hostname).toBe("127.0.0.1");
      expect(Number(url.port)).toBeGreaterThan(0);
      expect(url.pathname).toBe("/oauth/callback");
    } finally {
      await runTest(Scope.close(scope, Exit.void));
    }
  });

  test("delivers an exact GET callback and serves a hardened page", async () => {
    const { callbacks, redirectUri, scope } = await runTest(listen);

    try {
      const response = await runRequest(redirectUri, {
        path: "/oauth/callback?code=the-code&state=the-state",
      });

      expect(response.status).toBe(200);
      expect(response.body).toContain("You can close this tab");
      expect(response.headers).toMatchObject({
        "cache-control": "no-store",
        "content-security-policy": "default-src 'none'",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
      });
      expect(callbacks).toEqual([
        `${redirectUri}?code=the-code&state=the-state`,
      ]);
    } finally {
      await runTest(Scope.close(scope, Exit.void));
    }
  });

  test.each([
    ["another path", { path: "/oauth/other?code=c&state=s" }, 404],
    [
      "a POST",
      { method: "POST", path: "/oauth/callback?code=c&state=s" } as const,
      405,
    ],
    [
      "a foreign Host header",
      { host: "attacker.example", path: "/oauth/callback?code=c&state=s" },
      404,
    ],
  ])("rejects %s without delivering it", async (_name, request, status) => {
    const { callbacks, redirectUri, scope } = await runTest(listen);

    try {
      const response = await runRequest(redirectUri, request);

      expect(response.status).toBe(status);
      expect(callbacks).toEqual([]);
    } finally {
      await runTest(Scope.close(scope, Exit.void));
    }
  });

  test("stops listening when its scope closes", async () => {
    const { redirectUri, scope } = await runTest(listen);

    await runTest(Scope.close(scope, Exit.void));

    const exit = await sendRequest(redirectUri, {
      path: "/oauth/callback?code=c&state=s",
    }).pipe(E.provide(NodeHttpClientLayer), E.exit, runTest);

    expect(Exit.isFailure(exit)).toBe(true);
  });
});
