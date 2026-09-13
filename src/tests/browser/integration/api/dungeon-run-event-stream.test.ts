import { NodeHttpServer } from "@effect/platform-node";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as Socket from "effect/unstable/socket/Socket";
import { describe, expect, test } from "vitest";

import { ROUTES } from "@/api/constants/routes.ts";
import {
  type DungeonRunApiMessage,
  DungeonRunApiMessageSchema,
} from "@/api/websocket/dungeon-run/dungeon-run-api-message-schema.ts";
import { API_CONNECTION_STATE } from "@/electron/renderer/api/common.ts";
import {
  type DungeonRunEventStreamEvent,
  makeDungeonRunEventStreamForUrl,
} from "@/electron/renderer/api/dungeon-run/dungeon-run-event-stream.ts";
import { DUNGEON_RUN_EVENT_MESSAGE_DECODE_ERROR } from "@/errors/dungeon-run-event-stream-error.ts";
import { DungeonRunWebSocketBroadcaster } from "@/services/api/websocket-broadcaster-service.ts";
import { ApiServerTest } from "@/tests/common/layers/api-server-test-layer.ts";
import { runTest } from "@/tests/common/run-test.ts";

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

function getWebSocketUrl(address: HttpServer.Address): string {
  if (address._tag === "UnixAddress") {
    throw new Error("WebSocket test does not support Unix socket addresses.");
  }

  const hostname =
    address.hostname === "0.0.0.0" ? "127.0.0.1" : address.hostname;

  return `ws://${hostname}:${address.port}${ROUTES.dungeonRunEvents}`;
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

      const closeNormally = writer(
        new Socket.CloseEvent(1000, "Normal test disconnect."),
      ).pipe(E.ignore);

      yield* socket
        .runRaw(
          () => {
            return E.void;
          },
          {
            onOpen: closeNormally,
          },
        )
        .pipe(
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
            state: API_CONNECTION_STATE.CONNECTING,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_CONNECTION_STATE.CONNECTED,
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
              event.state === API_CONNECTION_STATE.CONNECTED
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
            state: API_CONNECTION_STATE.CONNECTING,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_CONNECTION_STATE.CONNECTED,
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
          E.catchTag(DUNGEON_RUN_EVENT_MESSAGE_DECODE_ERROR, () => {
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
            state: API_CONNECTION_STATE.CONNECTING,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_CONNECTION_STATE.DISCONNECTED,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_CONNECTION_STATE.CONNECTING,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_CONNECTION_STATE.DISCONNECTED,
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
            state: API_CONNECTION_STATE.CONNECTING,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_CONNECTION_STATE.CONNECTED,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_CONNECTION_STATE.DISCONNECTED,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_CONNECTION_STATE.CONNECTING,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_CONNECTION_STATE.CONNECTED,
            type: "CONNECTION_STATE_CHANGED",
          },
          {
            state: API_CONNECTION_STATE.DISCONNECTED,
            type: "CONNECTION_STATE_CHANGED",
          },
        ]);
      }).pipe(E.provide(NormalCloseEventStreamTestLive)),
    );

    await runTest(program);
  });
});
