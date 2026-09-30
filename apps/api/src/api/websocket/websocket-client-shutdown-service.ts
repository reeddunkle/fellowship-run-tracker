import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

export type WebSocketClientShutdownShape = {
  readonly awaitShutdown: E.Effect<void>;
  readonly shutdown: E.Effect<void>;
};

const makeWebSocketClientShutdown = E.gen(function* () {
  const shutdownStarted = yield* Deferred.make<void>();

  return {
    awaitShutdown: Deferred.await(shutdownStarted),
    shutdown: Deferred.succeed(shutdownStarted, undefined).pipe(E.asVoid),
  } satisfies WebSocketClientShutdownShape;
});

export class WebSocketClientShutdown extends Context.Service<
  WebSocketClientShutdown,
  WebSocketClientShutdownShape
>()(
  "@frt/api/api/websocket/websocket-client-shutdown-service/WebSocketClientShutdown",
) {
  static readonly layer = Layer.effect(this, makeWebSocketClientShutdown);
}

const ShutdownWebSocketClientsLayer = Layer.effectDiscard(
  E.gen(function* () {
    const webSocketClientShutdown = yield* WebSocketClientShutdown;

    yield* E.addFinalizer(() => {
      return webSocketClientShutdown.shutdown;
    });
  }),
);

export function shutdownWebSocketClientsFirst<ROut, Error, RIn>(
  servingLayer: Layer.Layer<ROut, Error, RIn>,
) {
  return ShutdownWebSocketClientsLayer.pipe(Layer.provideMerge(servingLayer));
}
