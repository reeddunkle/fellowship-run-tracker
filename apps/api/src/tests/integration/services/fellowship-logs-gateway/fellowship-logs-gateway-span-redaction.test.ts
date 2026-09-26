import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Tracer from "effect/Tracer";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import { describe, expect, test } from "vitest";

import { makeFellowshipLogsGatewayHttpQuery } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-http-query.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const CLIENT_ID = "test-client-id";
const CLIENT_SECRET = "test-client-secret-value";
const ACCESS_TOKEN = "test-access-token-value";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

const StubHttpClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request, url) => {
    const body = url.pathname.endsWith("/oauth/token")
      ? { access_token: ACCESS_TOKEN, expires_in: 3600, token_type: "Bearer" }
      : { data: { ok: true } };

    return E.succeed(HttpClientResponse.fromWeb(request, jsonResponse(body)));
  }),
);

function makeRecordingTracer() {
  const spans: Array<Tracer.NativeSpan> = [];

  const tracer = Tracer.make({
    span: (options) => {
      const span = new Tracer.NativeSpan(options);
      spans.push(span);
      return span;
    },
  });

  return { spans, tracer };
}

describe("Fellowship Logs gateway spans", () => {
  test("never record the client secret or the access token", async () => {
    const { spans, tracer } = makeRecordingTracer();

    await E.gen(function* () {
      const query = yield* makeFellowshipLogsGatewayHttpQuery(() => {
        return E.succeed({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
      });

      yield* query({ query: "{ ok }" }, Schema.Struct({ ok: Schema.Boolean }));
    }).pipe(
      E.withSpan("test-request"),
      E.withTracer(tracer),
      E.provide(StubHttpClientLayer),
      runTest,
    );

    const recorded = JSON.stringify(
      spans.map((span) => {
        return {
          attributes: Object.fromEntries(span.attributes),
          events: span.events,
          name: span.name,
        };
      }),
    );

    expect(spans.some((span) => span.name.startsWith("http.client"))).toBe(
      true,
    );
    expect(recorded).toContain('"http.request.header.authorization"');
    expect(recorded).not.toContain(CLIENT_SECRET);
    expect(recorded).not.toContain(ACCESS_TOKEN);
    expect(recorded).not.toContain(btoa(`${CLIENT_ID}:${CLIENT_SECRET}`));
  });
});
