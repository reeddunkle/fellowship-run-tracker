import * as E from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { type DungeonRunWebSocketBroadcasterShape } from "@frt/api/api/websocket/dungeon-run/dungeon-run-websocket-broadcaster-service.ts";

export function makeWebSocketBroadcasterTestHarness() {
  return E.gen(function* () {
    const messages = yield* Ref.make<ReadonlyArray<string>>([]);

    const webSocketBroadcaster = {
      messages: Stream.die("unexpected call: messages"),

      publish: (message: string) => {
        return Ref.update(messages, (currentMessages) => {
          return [...currentMessages, message];
        });
      },
    } satisfies DungeonRunWebSocketBroadcasterShape;

    const getMessages = () => {
      return Ref.get(messages);
    };

    const getParsedMessages = () => {
      return Ref.get(messages).pipe(
        E.map((storedMessages) => {
          return storedMessages.map((message) => {
            return JSON.parse(message) as unknown;
          });
        }),
      );
    };

    return {
      getMessages,
      getParsedMessages,
      webSocketBroadcaster,
    };
  });
}
