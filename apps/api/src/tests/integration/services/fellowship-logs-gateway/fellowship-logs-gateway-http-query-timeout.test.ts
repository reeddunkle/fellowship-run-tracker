import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { describe, expect, test } from "vitest";

import { FellowshipLogsGatewayRequestError } from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { makeClientCredentialsGatewayAccessSource } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-access.ts";
import {
  makeFellowshipLogsGatewayHttpQuery,
  REQUEST_TIMEOUT,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-http-query.ts";
import { FellowshipLogsGatewayRequestPacer } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-request-pacer.ts";
import { makeQuery } from "@frt/api/services/fellowship-logs-gateway/query/make-query.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const OkResponseSchema = Schema.Struct({ ok: Schema.Boolean });

const OK_QUERY = makeQuery({
  capability: "UNCLASSIFIED",
  selections: ["ok"],
});

type HangingEndpoint = "query" | "token";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function makeFirstCallHangingHttpClientLayer(hangingEndpoint: HangingEndpoint) {
  let hangingEndpointCallCount = 0;

  return Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      const endpoint: HangingEndpoint = url.pathname.endsWith("/oauth/token")
        ? "token"
        : "query";

      if (endpoint === hangingEndpoint) {
        hangingEndpointCallCount += 1;

        if (hangingEndpointCallCount === 1) {
          return E.never;
        }
      }

      const body =
        endpoint === "token"
          ? { access_token: "token", expires_in: 3600, token_type: "Bearer" }
          : { data: { ok: true } };

      return E.succeed(HttpClientResponse.fromWeb(request, jsonResponse(body)));
    }),
  );
}

function runQueriesAfterFirstCallHangs(hangingEndpoint: HangingEndpoint) {
  return E.gen(function* () {
    const query = yield* makeFellowshipLogsGatewayHttpQuery(
      makeClientCredentialsGatewayAccessSource({
        clientId: "client",
        clientSecret: "secret",
      }),
    );

    const hangingQuery = yield* E.forkChild(
      query({ query: OK_QUERY }, OkResponseSchema).pipe(E.flip),
    );

    yield* TestClock.adjust(REQUEST_TIMEOUT);

    const timeoutError = yield* Fiber.join(hangingQuery);

    const nextQuery = yield* E.forkChild(
      query({ query: OK_QUERY }, OkResponseSchema),
    );

    yield* TestClock.adjust("1 second");

    const nextResult = yield* Fiber.join(nextQuery);

    return { nextResult, timeoutError };
  }).pipe(
    E.provide(
      Layer.mergeAll(
        makeFirstCallHangingHttpClientLayer(hangingEndpoint),
        FellowshipLogsGatewayRequestPacer.layer,
        TestClock.layer(),
      ),
    ),
  );
}

describe("Fellowship Logs gateway request timeouts", () => {
  test("fails a query whose response never arrives and frees the pacer for the next query", async () => {
    const { nextResult, timeoutError } = await runTest(
      runQueriesAfterFirstCallHangs("query"),
    );

    expect(timeoutError).toBeInstanceOf(FellowshipLogsGatewayRequestError);
    expect(nextResult).toEqual({ data: { ok: true } });
  });

  test("fails a query whose access token request never completes and lets the next query request a token", async () => {
    const { nextResult, timeoutError } = await runTest(
      runQueriesAfterFirstCallHangs("token"),
    );

    expect(timeoutError).toBeInstanceOf(FellowshipLogsGatewayRequestError);
    expect(nextResult).toEqual({ data: { ok: true } });
  });
});
