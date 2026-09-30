import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as RcMap from "effect/RcMap";
import * as Stream from "effect/Stream";

import { makeBackgroundJobChannelFeed } from "@frt/api/api/websocket/background-job/background-job-channel-feed.ts";
import { makeLiveSplitChannelFeed } from "@frt/api/api/websocket/live-split/live-split-channel-feed.ts";
import { makeTrackingChannelFeed } from "@frt/api/api/websocket/tracking/tracking-channel-feed.ts";

type WebSocketChannelKey = "backgroundJob" | "liveSplit" | "tracking";

export type WebSocketChannelShape = {
  readonly messages: (channel: WebSocketChannelKey) => Stream.Stream<string>;
};

const CHANNEL_IDLE_TIME_TO_LIVE = "5 seconds";

const makeWebSocketChannel = E.gen(function* () {
  const feeds: Record<WebSocketChannelKey, Stream.Stream<string>> = {
    backgroundJob: yield* makeBackgroundJobChannelFeed,
    liveSplit: yield* makeLiveSplitChannelFeed,
    tracking: yield* makeTrackingChannelFeed,
  };

  const serviceScope = yield* E.scope;

  const closeChannel = ({
    channel,
    pubsub,
  }: {
    readonly channel: WebSocketChannelKey;
    readonly pubsub: PubSub.PubSub<string>;
  }) => {
    return RcMap.invalidate(channels, channel).pipe(
      E.andThen(PubSub.shutdown(pubsub)),
      E.forkIn(serviceScope),
      E.asVoid,
    );
  };

  const lookupChannel = E.fn(function* (channel: WebSocketChannelKey) {
    const pubsub = yield* E.acquireRelease(
      PubSub.unbounded<string>({ replay: 1 }),
      PubSub.shutdown,
    );

    yield* E.acquireRelease(
      E.logDebug("WebSocket channel started.", { channel }),
      () => {
        return E.logDebug("WebSocket channel stopped.", { channel });
      },
    );

    yield* feeds[channel].pipe(
      Stream.runForEach((message) => {
        return PubSub.publish(pubsub, message);
      }),
      E.onExit((exit) => {
        if (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)) {
          return E.void;
        }

        return E.logWarning("WebSocket channel feed ended; closing channel.", {
          cause: Exit.isFailure(exit) ? Cause.pretty(exit.cause) : undefined,
          channel,
        }).pipe(
          E.andThen(
            closeChannel({
              channel,
              pubsub,
            }),
          ),
        );
      }),
      E.forkScoped,
    );

    return pubsub;
  });

  const channels: RcMap.RcMap<
    WebSocketChannelKey,
    PubSub.PubSub<string>
  > = yield* RcMap.make({
    idleTimeToLive: CHANNEL_IDLE_TIME_TO_LIVE,
    lookup: lookupChannel,
  });

  const messages: WebSocketChannelShape["messages"] = (channel) => {
    return Stream.unwrap(
      RcMap.get(channels, channel).pipe(E.map(Stream.fromPubSub)),
    );
  };

  return {
    messages,
  } satisfies WebSocketChannelShape;
});

export class WebSocketChannel extends Context.Service<
  WebSocketChannel,
  WebSocketChannelShape
>()("@frt/api/api/websocket/websocket-channel-service/WebSocketChannel") {
  static readonly layer = Layer.effect(this, makeWebSocketChannel);
}
