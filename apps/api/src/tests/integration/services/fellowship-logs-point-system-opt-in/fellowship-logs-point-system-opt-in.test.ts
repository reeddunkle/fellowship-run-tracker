import { Buffer } from "node:buffer";

import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FellowshipLogsAccessToken } from "@frt/api/services/fellowship-logs-access-token/fellowship-logs-access-token-service.ts";
import {
  FellowshipLogsConnection,
  type FellowshipLogsConnectionShape,
} from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import { FellowshipLogsGatewayRequestPacer } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-request-pacer.ts";
import { FellowshipLogsPointSystemOptIn } from "@frt/api/services/fellowship-logs-point-system-opt-in/fellowship-logs-point-system-opt-in-service.ts";
import {
  ProtectedValueStorage,
  type ProtectedValueStorageShape,
} from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsAuthorizationTransactionDAO } from "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao.ts";
import { FellowshipLogsConnectionDAO } from "@frt/db/daos/fellowship-logs-connection/fellowship-logs-connection-dao.ts";
import { makeMainDatabaseLayer } from "@frt/db/databases/main-database.ts";
import { ProtectedValueSchema } from "@frt/db/validation/encryption/protected-value-schema.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  type FellowshipLogsAuthorizedProfile,
  FellowshipLogsConnectedUserIdSchema,
  FellowshipLogsConnectedUserNameSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const CLIENT_ID = Schema.decodeSync(FellowshipLogsClientIdSchema)("client-id");
const CONNECTED_USER_ID = Schema.decodeSync(
  FellowshipLogsConnectedUserIdSchema,
)("13100");
const CONNECTED_USER_NAME = Schema.decodeSync(
  FellowshipLogsConnectedUserNameSchema,
)("Player Name");
const encodeProtectedValue = Schema.encodeSync(ProtectedValueSchema);
const decodeProtectedValue = Schema.decodeSync(ProtectedValueSchema);

const OsBackedProtectedValueStorage: ProtectedValueStorageShape = {
  getProtectionStatus: () =>
    E.succeed({
      activeProtection: "OS_BACKED",
      requiresLocalFallbackAcknowledgement: false,
    }),
  protect: (value) =>
    E.succeed(
      encodeProtectedValue({
        protection: "OS_BACKED",
        value: Buffer.from(Redacted.value(value)).toString("base64url"),
        version: 1,
      }),
    ),
  unprotect: (value) =>
    E.succeed(
      Redacted.make(
        Buffer.from(decodeProtectedValue(value).value, "base64url").toString(
          "utf8",
        ),
      ),
    ),
};

const OPT_IN_REQUIRED_BODY = {
  data: null,
  errors: [
    {
      message:
        "cannot require only user points be spent without authenticating a user and opting into the new point system",
    },
  ],
};

const OPTED_IN_BODY = {
  data: {
    rateLimitData: { currentRequest: { application: 0, total: 1 } },
  },
};

type RecordedRequest = {
  readonly path: string;
  readonly query: string | undefined;
};

function makeTestLayer({
  profile = "FELLOWSHIP_RUN_TRACKER_USER",
  responseBody = OPTED_IN_BODY,
}: {
  readonly profile?: FellowshipLogsAuthorizedProfile;
  readonly responseBody?: unknown;
} = {}) {
  const requests: Array<RecordedRequest> = [];
  const optInUpdates: Array<boolean> = [];
  const requestLeaseAcquisitions: Array<void> = [];

  const connection: FellowshipLogsConnectionShape = {
    changes: Stream.empty,
    disconnect: () => E.die("Unexpected disconnect."),
    getCredentials: () =>
      E.succeedSome({
        clientId: CLIENT_ID,
        connectedUserId: CONNECTED_USER_ID,
        pointSystemOptInRequired: true,
        profile,
        tokens: null,
      }),
    getSummary: () => E.die("Unexpected summary read."),
    replaceTokens: () => E.die("Unexpected token replacement."),
    requireReauthorization: () => E.die("Unexpected reauthorization."),
    saveAuthorizedSession: () => E.die("Unexpected session save."),
    saveOwnClient: () => E.die("Unexpected client save."),
    setPointSystemOptInRequired: ({ required }) => {
      optInUpdates.push(required);

      return E.succeed("UPDATED");
    },
    withRequestLease: (effect) =>
      E.sync(() => {
        requestLeaseAcquisitions.push(undefined);
      }).pipe(E.andThen(effect)),
  };

  const HttpClientLayer = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      const body =
        request.body._tag === "Uint8Array"
          ? (JSON.parse(new TextDecoder().decode(request.body.body)) as {
              readonly query?: string;
            })
          : {};

      requests.push({ path: url.pathname, query: body.query });

      return E.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify(responseBody), {
            headers: { "content-type": "application/json" },
            status: 200,
          }),
        ),
      );
    }),
  );

  const layer = FellowshipLogsPointSystemOptIn.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        HttpClientLayer,
        FellowshipLogsGatewayRequestPacer.layer,
        Layer.succeed(FellowshipLogsConnection, connection),
        Layer.succeed(FellowshipLogsAccessToken, {
          get: () =>
            E.succeed({
              accessToken: Redacted.make("user-token"),
              clientId: CLIENT_ID,
              profile,
            }),
          reportRejected: () => E.void,
        }),
      ),
    ),
  );

  return { layer, optInUpdates, requestLeaseAcquisitions, requests };
}

function check(layer: Layer.Layer<FellowshipLogsPointSystemOptIn>) {
  return FellowshipLogsPointSystemOptIn.use((service) => {
    return service.check();
  }).pipe(E.provide(layer), runTest);
}

function makeLeasedTestLayer(
  requestStarted: Deferred.Deferred<void>,
  releaseResponse: Deferred.Deferred<void>,
) {
  const MainDatabaseLayer = makeMainDatabaseLayer(":memory:");
  const DAOsLayer = Layer.mergeAll(
    FellowshipLogsAuthorizationTransactionDAO.layer,
    FellowshipLogsConnectionDAO.layer,
  ).pipe(Layer.provideMerge(MainDatabaseLayer));
  const ConnectionLayer = FellowshipLogsConnection.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        DAOsLayer,
        NodeCrypto.layer,
        Layer.succeed(ProtectedValueStorage, OsBackedProtectedValueStorage),
      ),
    ),
  );
  const HttpClientLayer = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) => {
      return Deferred.succeed(requestStarted, undefined).pipe(
        E.andThen(Deferred.await(releaseResponse)),
        E.as(
          HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify(OPT_IN_REQUIRED_BODY), {
              headers: { "content-type": "application/json" },
              status: 200,
            }),
          ),
        ),
      );
    }),
  );
  const PointSystemOptInLayer = FellowshipLogsPointSystemOptIn.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        HttpClientLayer,
        FellowshipLogsGatewayRequestPacer.layer,
        ConnectionLayer,
        Layer.succeed(FellowshipLogsAccessToken, {
          get: () =>
            E.succeed({
              accessToken: Redacted.make("user-token"),
              clientId: CLIENT_ID,
              profile: "FELLOWSHIP_RUN_TRACKER_USER",
            }),
          reportRejected: () => E.void,
        }),
      ),
    ),
  );

  return Layer.merge(ConnectionLayer, PointSystemOptInLayer);
}

describe("FellowshipLogsPointSystemOptIn.check", () => {
  test("confirms the opt-in with a strict user-point request even while it is marked missing", async () => {
    const { layer, optInUpdates, requestLeaseAcquisitions, requests } =
      makeTestLayer();

    const result = await check(layer);

    expect(result).toBe("OPTED_IN");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.path).toBe("/api/v2/user");
    expect(requests[0]?.query).toContain("@onlySpendUserPoints");
    expect(requests[0]?.query).toContain("currentRequest");
    expect(optInUpdates).toEqual([false]);
    expect(requestLeaseAcquisitions).toHaveLength(1);
  });

  test("records a missing opt-in", async () => {
    const { layer, optInUpdates } = makeTestLayer({
      responseBody: OPT_IN_REQUIRED_BODY,
    });

    const result = await check(layer);

    expect(result).toBe("OPT_IN_REQUIRED");
    expect(optInUpdates).toEqual([true]);
  });

  test("sends nothing for a profile that does not need the opt-in", async () => {
    const { layer, optInUpdates, requestLeaseAcquisitions, requests } =
      makeTestLayer({
        profile: "OWN_CLIENT_USER",
      });

    const result = await check(layer);

    expect(result).toBe("NOT_REQUIRED");
    expect(requests).toHaveLength(0);
    expect(optInUpdates).toEqual([]);
    expect(requestLeaseAcquisitions).toHaveLength(1);
  });

  test("holds the request lease until the result is applied to the checked connection", async () => {
    const result = await E.gen(function* () {
      const requestStarted = yield* Deferred.make<void>();
      const releaseResponse = yield* Deferred.make<void>();
      const layer = makeLeasedTestLayer(requestStarted, releaseResponse);

      return yield* E.gen(function* () {
        const connection = yield* FellowshipLogsConnection;
        const pointSystemOptIn = yield* FellowshipLogsPointSystemOptIn;

        yield* connection.saveAuthorizedSession({
          accessToken: Redacted.make("initial-access-token"),
          accessTokenExpiresAt: DateTime.makeUnsafe("2027-10-25T00:00:00Z"),
          allowLocalFallback: false,
          clientId: CLIENT_ID,
          connectedUserId: CONNECTED_USER_ID,
          connectedUserName: CONNECTED_USER_NAME,
          expectedGeneration: null,
          profile: "FELLOWSHIP_RUN_TRACKER_USER",
          refreshToken: null,
        });
        const initialGeneration = Option.getOrThrow(
          yield* connection.getSummary(),
        ).generation;
        const checking = yield* pointSystemOptIn.check().pipe(E.forkChild);

        yield* Deferred.await(requestStarted);

        const replacing = yield* connection
          .saveAuthorizedSession({
            accessToken: Redacted.make("replacement-access-token"),
            accessTokenExpiresAt: DateTime.makeUnsafe("2027-10-25T00:00:00Z"),
            allowLocalFallback: false,
            clientId: CLIENT_ID,
            connectedUserId: CONNECTED_USER_ID,
            connectedUserName: CONNECTED_USER_NAME,
            expectedGeneration: initialGeneration,
            profile: "FELLOWSHIP_RUN_TRACKER_USER",
            refreshToken: null,
          })
          .pipe(E.forkChild);

        yield* E.sleep("50 millis");
        const replacementBeforeResponse = replacing.pollUnsafe();

        yield* Deferred.succeed(releaseResponse, undefined);
        const checkResult = yield* Fiber.join(checking);
        yield* Fiber.join(replacing);
        const connectionAfterReplacement = Option.getOrThrow(
          yield* connection.getSummary(),
        );

        return {
          checkResult,
          connectionAfterReplacement,
          initialGeneration,
          replacementBeforeResponse,
        };
      }).pipe(E.provide(layer));
    }).pipe(runTest);

    expect(result.replacementBeforeResponse).toBeUndefined();
    expect(result.checkResult).toBe("OPT_IN_REQUIRED");
    expect(result.connectionAfterReplacement.generation).not.toBe(
      result.initialGeneration,
    );
    expect(result.connectionAfterReplacement.status).toBe("CONNECTED");
  });
});
