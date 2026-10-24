import * as E from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipLogsGatewayAccessError } from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import {
  type FellowshipLogsGatewayAccess,
  type FellowshipLogsGatewayAccessSource,
  makeClientCredentialsGatewayAccessSource,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-access.ts";
import { makeFellowshipLogsGatewayHttpQuery } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-http-query.ts";
import { FellowshipLogsGatewayRequestPacer } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-request-pacer.ts";
import {
  type FellowshipLogsGatewayQuery,
  makeQuery,
} from "@frt/api/services/fellowship-logs-gateway/query/make-query.ts";
import { RATE_LIMIT_DATA_QUERY } from "@frt/api/services/fellowship-logs-gateway/query/rate-limit-data-query.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import {
  type FellowshipLogsAuthorizedProfile,
  FellowshipLogsConnectedUserIdSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const OkResponseSchema = Schema.Struct({ ok: Schema.Boolean });

const CLIENT_ACCESS_TOKEN = "client-access-token";

const CONNECTED_USER_ID = Schema.decodeSync(
  FellowshipLogsConnectedUserIdSchema,
)("13100");

const MALFORMED_ELIGIBLE_QUERY = {
  capability: "USER_POINT_ELIGIBLE",
  document: "{ ok }",
} as const satisfies FellowshipLogsGatewayQuery;

const UNCLASSIFIED_QUERY = makeQuery({
  capability: "UNCLASSIFIED",
  name: "Rankings",
  selections: ['reportData { report(code: "abc") { rankings } }'],
});

type RecordedRequest = {
  readonly authorization: string | undefined;
  readonly path: string;
  readonly query: string | undefined;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function makeRecordingHttpClient({
  queryResponseBody = { data: { ok: true } },
  rejectedAccessTokens = [],
}: {
  readonly queryResponseBody?: unknown;
  readonly rejectedAccessTokens?: ReadonlyArray<string>;
} = {}) {
  const requests: Array<RecordedRequest> = [];

  const layer = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      const authorization = request.headers.authorization;

      if (url.pathname.endsWith("/oauth/token")) {
        requests.push({ authorization, path: url.pathname, query: undefined });

        return E.succeed(
          HttpClientResponse.fromWeb(
            request,
            jsonResponse({
              access_token: CLIENT_ACCESS_TOKEN,
              expires_in: 3600,
              token_type: "Bearer",
            }),
          ),
        );
      }

      const body =
        request.body._tag === "Uint8Array"
          ? (JSON.parse(new TextDecoder().decode(request.body.body)) as {
              readonly query?: string;
            })
          : {};

      requests.push({ authorization, path: url.pathname, query: body.query });

      const isRejected = rejectedAccessTokens.some((token) => {
        return authorization === `Bearer ${token}`;
      });

      return E.succeed(
        HttpClientResponse.fromWeb(
          request,
          isRejected
            ? jsonResponse({ error: "unauthenticated" }, 401)
            : jsonResponse(queryResponseBody),
        ),
      );
    }),
  );

  return { layer, requests };
}

function makeSignedInAccessSource(
  profile: FellowshipLogsAuthorizedProfile,
  accessTokens: ReadonlyArray<string>,
  reportRejected: FellowshipLogsGatewayAccessSource["reportRejected"] = () =>
    E.void,
) {
  const remaining = [...accessTokens];
  const rejected: Array<string> = [];
  const optInReports: Array<boolean> = [];

  const source: FellowshipLogsGatewayAccessSource = {
    get: () => {
      const accessToken =
        remaining.length > 1 ? remaining.shift() : remaining[0];

      return E.succeed({
        accessToken: Redacted.make(accessToken ?? ""),
        connectedUserId: CONNECTED_USER_ID,
        profile,
      } satisfies FellowshipLogsGatewayAccess);
    },
    getRequestContext: () => E.die("Unexpected request context read."),
    reportPointSystemOptIn: (options) => {
      optInReports.push(options.required);

      return E.void;
    },
    reportRejected: (accessToken) => {
      rejected.push(Redacted.value(accessToken));

      return reportRejected(accessToken);
    },
    withRequest: (effect) => effect,
  };

  return { optInReports, rejected, source };
}

function runQuery(
  source: FellowshipLogsGatewayAccessSource,
  httpClientLayer: Layer.Layer<HttpClient.HttpClient>,
  query = RATE_LIMIT_DATA_QUERY,
) {
  return E.gen(function* () {
    const httpQuery = yield* makeFellowshipLogsGatewayHttpQuery(source);

    return yield* httpQuery({ query }, OkResponseSchema).pipe(E.result);
  }).pipe(
    E.provide(
      Layer.mergeAll(httpClientLayer, FellowshipLogsGatewayRequestPacer.layer),
    ),
    runTest,
  );
}

describe("Fellowship Logs gateway access policy", () => {
  test("sends the recommended profile to the user endpoint with only user points", async () => {
    const http = makeRecordingHttpClient();
    const { source } = makeSignedInAccessSource("FELLOWSHIP_RUN_TRACKER_USER", [
      "user-token",
    ]);

    await runQuery(source, http.layer);

    expect(http.requests).toHaveLength(1);
    expect(http.requests[0]).toMatchObject({
      authorization: "Bearer user-token",
      path: "/api/v2/user",
    });
    expect(http.requests[0]?.query).toContain("@onlySpendUserPoints");
  });

  test("sends the own-client sign-in profile to the user endpoint without the directive", async () => {
    const http = makeRecordingHttpClient();
    const { source } = makeSignedInAccessSource("OWN_CLIENT_USER", [
      "user-token",
    ]);

    await runQuery(source, http.layer);

    expect(http.requests).toHaveLength(1);
    expect(http.requests[0]).toMatchObject({
      authorization: "Bearer user-token",
      path: "/api/v2/user",
    });
    expect(http.requests[0]?.query).not.toContain("@onlySpendUserPoints");
  });

  test("sends the client-credentials profile to the client endpoint without the directive", async () => {
    const http = makeRecordingHttpClient();

    await runQuery(
      makeClientCredentialsGatewayAccessSource({
        clientId: "client",
        clientSecret: "secret",
      }),
      http.layer,
    );

    expect(http.requests.map((request) => request.path)).toEqual([
      "/oauth/token",
      "/api/v2/client",
    ]);
    expect(http.requests[1]).toMatchObject({
      authorization: `Bearer ${CLIENT_ACCESS_TOKEN}`,
    });
    expect(http.requests[1]?.query).not.toContain("@onlySpendUserPoints");
  });

  test("refuses a strict request it cannot limit to user points without sending it", async () => {
    const http = makeRecordingHttpClient();
    const { source } = makeSignedInAccessSource("FELLOWSHIP_RUN_TRACKER_USER", [
      "user-token",
    ]);

    const result = await runQuery(source, http.layer, MALFORMED_ELIGIBLE_QUERY);

    expect(http.requests).toHaveLength(0);
    expect(result).toMatchObject({
      failure: {
        _tag: "FellowshipLogsGatewayPointPolicyError",
        reason: "DirectiveNotApplicable",
      },
    });
  });

  test("refuses an unclassified strict request without sending it", async () => {
    const http = makeRecordingHttpClient();
    const { source } = makeSignedInAccessSource("FELLOWSHIP_RUN_TRACKER_USER", [
      "user-token",
    ]);

    const result = await runQuery(source, http.layer, UNCLASSIFIED_QUERY);

    expect(http.requests).toHaveLength(0);
    expect(result).toMatchObject({
      failure: {
        _tag: "FellowshipLogsGatewayPointPolicyError",
        reason: "NotUserEligible",
      },
    });
  });

  test("sends the same fields under default spending", async () => {
    const http = makeRecordingHttpClient();
    const { source } = makeSignedInAccessSource("OWN_CLIENT_USER", [
      "user-token",
    ]);

    await runQuery(source, http.layer, UNCLASSIFIED_QUERY);

    expect(http.requests).toHaveLength(1);
  });

  test("reports a rejected access token and retries with the replacement", async () => {
    const http = makeRecordingHttpClient({
      rejectedAccessTokens: ["stale-token"],
    });
    const { rejected, source } = makeSignedInAccessSource(
      "FELLOWSHIP_RUN_TRACKER_USER",
      ["stale-token", "fresh-token"],
    );

    const result = await runQuery(source, http.layer);

    expect(rejected).toEqual(["stale-token"]);
    expect(http.requests.map((request) => request.authorization)).toEqual([
      "Bearer stale-token",
      "Bearer fresh-token",
    ]);
    expect(result).toMatchObject({ success: { data: { ok: true } } });
  });

  test("requires reauthorization when the rejected session cannot recover", async () => {
    const http = makeRecordingHttpClient({
      rejectedAccessTokens: ["stale-token"],
    });
    const { source } = makeSignedInAccessSource(
      "OWN_CLIENT_USER",
      ["stale-token"],
      () => {
        return E.fail(
          new FellowshipLogsGatewayAccessError({
            cause: null,
            reason: "ReauthorizationRequired",
          }),
        );
      },
    );

    const result = await runQuery(source, http.layer);

    expect(http.requests).toHaveLength(1);
    expect(result).toMatchObject({
      failure: {
        _tag: "FellowshipLogsGatewayAccessError",
        reason: "ReauthorizationRequired",
      },
    });
  });

  test("stops after a second rejection instead of retrying again", async () => {
    const http = makeRecordingHttpClient({
      rejectedAccessTokens: ["stale-token", "also-stale-token"],
    });
    const { source } = makeSignedInAccessSource("FELLOWSHIP_RUN_TRACKER_USER", [
      "stale-token",
      "also-stale-token",
      "unused-token",
    ]);

    const result = await runQuery(source, http.layer);

    expect(http.requests).toHaveLength(2);
    expect(result).toMatchObject({
      failure: {
        _tag: "FellowshipLogsGatewayAccessError",
        reason: "ReauthorizationRequired",
      },
    });
  });

  test("records a missing point-system opt-in reported by the provider", async () => {
    const http = makeRecordingHttpClient({
      queryResponseBody: {
        data: null,
        errors: [
          {
            message:
              "cannot require only user points be spent without authenticating a user and opting into the new point system",
          },
        ],
      },
    });
    const { optInReports, source } = makeSignedInAccessSource(
      "FELLOWSHIP_RUN_TRACKER_USER",
      ["user-token"],
    );

    await runQuery(source, http.layer);

    expect(optInReports).toEqual([true]);
  });

  test("records nothing about the opt-in for a successful request", async () => {
    const http = makeRecordingHttpClient();
    const { optInReports, source } = makeSignedInAccessSource(
      "FELLOWSHIP_RUN_TRACKER_USER",
      ["user-token"],
    );

    await runQuery(source, http.layer);

    expect(optInReports).toEqual([]);
  });
});
