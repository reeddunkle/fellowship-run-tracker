import { NodeHttpServer } from "@effect/platform-node";
import * as Deferred from "effect/Deferred";
import type * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as NetAddress from "effect/net/NetAddress";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Socket from "effect/socket/Socket";
import { describe, expect, test } from "vitest";

import { DungeonRunWebSocketBroadcaster } from "@frt/api/api/websocket/dungeon-run/dungeon-run-websocket-broadcaster-service.ts";
import { ApiServerTest } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { ROUTES } from "@frt/api-contract/constants/routes.ts";
import {
  type DungeonRunApiMessage,
  DungeonRunApiMessageSchema,
} from "@frt/api-contract/websocket/dungeon-run/dungeon-run-api-message-schema.ts";

import { DungeonRunEventMessageDecodeError } from "@/errors/dungeon-run-event-message-error.ts";
import { API_EVENT_CONNECTION_STATE } from "@/renderer/api/common.ts";
import { type DungeonRunEventStreamEvent } from "@/renderer/api/dungeon-run/dungeon-run-event-stream.ts";
import { makeApiEventStream } from "@/renderer/api/make-api-event-stream.ts";

const MOCK_TIMEOUT = "1 second";
const MOCK_RECONNECT_DELAY = "10 millis";
const NORMAL_CLOSE_ROUTE = "/normal-close";

const DungeonRunApiMessageFromJsonStringSchema = Schema.fromJsonString(
  DungeonRunApiMessageSchema,
);

const UnknownFromJsonStringSchema = Schema.fromJsonString(Schema.Unknown);

const message = {
  state: {
    dungeonRun: {
      endedAtMilliseconds: null,
      startedAtMilliseconds: 1_000,
      status: "ACTIVE",
    },
    observations: [
      {
        targetId: "42",
        timestampMilliseconds: 1_500,
        type: "UNIT_DEATH",
      },
    ],
  },
  version: 1,
} satisfies DungeonRunApiMessage;

function makeDungeonRunEventStreamForUrl(
  url: string,
  options: { readonly reconnectDelay?: Duration.Input } = {},
) {
  return makeApiEventStream({
    ...options,
    connectionLostMessage: "Lost connection to the test event stream.",
    makeDecodeError: (cause) => {
      return new DungeonRunEventMessageDecodeError({
        cause,
      });
    },
    schema: DungeonRunApiMessageSchema,
    url,
  });
}

function getWebSocketUrl(address: NetAddress.SocketAddress): string {
  if (NetAddress.isUnixPathAddress(address)) {
    throw new Error("WebSocket test does not support Unix socket addresses.");
  }

  const hostAddress = NetAddress.isUnspecified(address.address)
    ? NetAddress.inetAddressUnsafe(NetAddress.ipv4Loopback, address.port)
    : address;

  return `${NetAddress.formatUrlUnsafe(hostAddress, "ws")}${ROUTES.dungeonRunEvents}`;
}

function collectClientEvents(
  stream: Stream.Stream<
    DungeonRunEventStreamEvent,
    unknown,
    Socket.WebSocketConstructor
  >,
  count: number,
) {
  return stream.pipe(
    Stream.take(count),
    Stream.runCollect,
    E.map((events) => {
      return Array.from(events);
    }),
    E.timeout(MOCK_TIMEOUT),
  );
}

const handleNormalCloseRequest = E.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;

  yield* E.scoped(
    E.gen(function* () {
      const socket = yield* request.upgrade;
      const writer = yield* socket.writer;

      const closeNormally = writer
        .write(new Socket.CloseEvent(1000, "Normal test disconnect."))
        .pipe(E.ignore);

      yield* E.gen(function* () {
        const { pull } = yield* socket.reader;

        yield* closeNormally;

        return yield* pull.pipe(E.forever);
      }).pipe(
        /*
         * This route only exists to initiate a normal close. Any error from
         * the server side of the close handshake is irrelevant to the test.
         */
        E.ignore,
      );
    }),
  );

  return HttpServerResponse.empty();
});

const NormalCloseRoutes = HttpRouter.addAll([
  HttpRouter.route("GET", NORMAL_CLOSE_ROUTE, handleNormalCloseRequest),
]);

const NormalCloseServerTest = HttpRouter.serve(NormalCloseRoutes).pipe(
  Layer.provideMerge(NodeHttpServer.layerTest),
);

const DungeonRunEventStreamTestLive = Layer.mergeAll(
  ApiServerTest,
  Socket.layerWebSocketConstructorGlobal,
);

const NormalCloseEventStreamTestLive = Layer.mergeAll(
  NormalCloseServerTest,
  Socket.layerWebSocketConstructorGlobal,
);

describe("Dungeon Run event stream", () => {
  test("connects and receives the latest API state", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const dungeonRunWebSocketBroadcaster =
          yield* DungeonRunWebSocketBroadcaster;
        const httpServer = yield* HttpServer.HttpServer;

        const websocketUrl = getWebSocketUrl(httpServer.address);

        const encodedMessage = yield* Schema.encodeEffect(
          DungeonRunApiMessageFromJsonStringSchema,
        )(message);

        yield* dungeonRunWebSocketBroadcaster.publish(encodedMessage);

        const clientEvents = yield* collectClientEvents(
          makeDungeonRunEventStreamForUrl(websocketUrl),
          3,
        );

        expect(clientEvents).toEqual([
          {
            state: API_EVENT_CONNECTION_STATE.CONNECTING,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_EVENT_CONNECTION_STATE.CONNECTED,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            message,
            type: "MESSAGE_RECEIVED",
          },
        ]);
      }).pipe(E.provide(DungeonRunEventStreamTestLive)),
    );

    await runTest(program);
  });

  test("receives API state published after connecting", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const dungeonRunWebSocketBroadcaster =
          yield* DungeonRunWebSocketBroadcaster;
        const httpServer = yield* HttpServer.HttpServer;

        const websocketUrl = getWebSocketUrl(httpServer.address);
        const connected = yield* Deferred.make<void>();

        const clientFiber = yield* makeDungeonRunEventStreamForUrl(
          websocketUrl,
        ).pipe(
          Stream.tap((event) => {
            if (
              event.type === "CONNECTION_STATE_CHANGED" &&
              event.state === API_EVENT_CONNECTION_STATE.CONNECTED
            ) {
              return Deferred.succeed(connected, undefined);
            }

            return E.void;
          }),
          Stream.take(3),
          Stream.runCollect,
          E.map((events) => {
            return Array.from(events);
          }),
          E.timeout(MOCK_TIMEOUT),
          E.forkScoped,
        );

        yield* Deferred.await(connected).pipe(E.timeout(MOCK_TIMEOUT));

        const encodedMessage = yield* Schema.encodeEffect(
          DungeonRunApiMessageFromJsonStringSchema,
        )(message);

        yield* dungeonRunWebSocketBroadcaster.publish(encodedMessage);

        const clientEvents = yield* Fiber.join(clientFiber);

        expect(clientEvents).toEqual([
          {
            state: API_EVENT_CONNECTION_STATE.CONNECTING,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_EVENT_CONNECTION_STATE.CONNECTED,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            message,
            type: "MESSAGE_RECEIVED",
          },
        ]);
      }).pipe(E.provide(DungeonRunEventStreamTestLive)),
    );

    await runTest(program);
  });

  test("fails when the API sends an invalid message", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const dungeonRunWebSocketBroadcaster =
          yield* DungeonRunWebSocketBroadcaster;
        const httpServer = yield* HttpServer.HttpServer;

        const websocketUrl = getWebSocketUrl(httpServer.address);

        const invalidMessage = yield* Schema.encodeEffect(
          UnknownFromJsonStringSchema,
        )({
          invalid: true,
        });

        yield* dungeonRunWebSocketBroadcaster.publish(invalidMessage);

        const wasDecodeError = yield* makeDungeonRunEventStreamForUrl(
          websocketUrl,
        ).pipe(
          Stream.runDrain,
          E.as(false),
          E.catchTag("DungeonRunEventMessageDecodeError", () => {
            return E.succeed(true);
          }),
          E.timeout(MOCK_TIMEOUT),
        );

        expect(wasDecodeError).toBe(true);
      }).pipe(E.provide(DungeonRunEventStreamTestLive)),
    );

    await runTest(program);
  });

  test("retries after a WebSocket connection failure", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;

        const websocketUrl = getWebSocketUrl(httpServer.address);
        const invalidWebsocketUrl = websocketUrl.replace(
          ROUTES.dungeonRunEvents,
          "/invalid",
        );

        const clientEvents = yield* collectClientEvents(
          makeDungeonRunEventStreamForUrl(invalidWebsocketUrl, {
            reconnectDelay: MOCK_RECONNECT_DELAY,
          }),
          4,
        );

        expect(clientEvents).toEqual([
          {
            state: API_EVENT_CONNECTION_STATE.CONNECTING,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_EVENT_CONNECTION_STATE.DISCONNECTED,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_EVENT_CONNECTION_STATE.CONNECTING,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_EVENT_CONNECTION_STATE.DISCONNECTED,
            type: "CONNECTION_STATE_CHANGED",
          },
        ]);
      }).pipe(E.provide(DungeonRunEventStreamTestLive)),
    );

    await runTest(program);
  });

  test("reconnects after a normal WebSocket close", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;

        const websocketUrl = getWebSocketUrl(httpServer.address).replace(
          ROUTES.dungeonRunEvents,
          NORMAL_CLOSE_ROUTE,
        );

        const clientEvents = yield* collectClientEvents(
          makeDungeonRunEventStreamForUrl(websocketUrl, {
            reconnectDelay: MOCK_RECONNECT_DELAY,
          }),
          6,
        );

        expect(clientEvents).toEqual([
          {
            state: API_EVENT_CONNECTION_STATE.CONNECTING,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_EVENT_CONNECTION_STATE.CONNECTED,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_EVENT_CONNECTION_STATE.DISCONNECTED,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_EVENT_CONNECTION_STATE.CONNECTING,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_EVENT_CONNECTION_STATE.CONNECTED,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_EVENT_CONNECTION_STATE.DISCONNECTED,
            type: "CONNECTION_STATE_CHANGED",
          },
        ]);
      }).pipe(E.provide(NormalCloseEventStreamTestLive)),
    );

    await runTest(program);
  });
});
