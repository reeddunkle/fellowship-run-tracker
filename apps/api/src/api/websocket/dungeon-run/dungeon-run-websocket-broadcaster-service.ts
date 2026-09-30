import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Stream from "effect/Stream";

export type DungeonRunWebSocketBroadcasterShape = {
  readonly messages: Stream.Stream<string>;

  readonly publish: (message: string) => E.Effect<void>;
};

const makeDungeonRunWebSocketBroadcaster = E.gen(function* () {
  const pubsub = yield* E.acquireRelease(
    PubSub.unbounded<string>({ replay: 1 }),
    PubSub.shutdown,
  );

  const publish: DungeonRunWebSocketBroadcasterShape["publish"] = (message) => {
    return PubSub.publish(pubsub, message).pipe(E.asVoid);
  };

  return {
    messages: Stream.fromPubSub(pubsub),
    publish,
  } satisfies DungeonRunWebSocketBroadcasterShape;
});

export class DungeonRunWebSocketBroadcaster extends Context.Service<
  DungeonRunWebSocketBroadcaster,
  DungeonRunWebSocketBroadcasterShape
>()(
  "@frt/api/api/websocket/dungeon-run/dungeon-run-websocket-broadcaster-service/DungeonRunWebSocketBroadcaster",
) {
  static readonly layer = Layer.effect(
    this,
    makeDungeonRunWebSocketBroadcaster,
  );
}
