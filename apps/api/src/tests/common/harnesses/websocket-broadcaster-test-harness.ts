import * as E from "effect/Effect";
import * as Ref from "effect/Ref";

import {
  type WebSocketBroadcasterService,
  type WebSocketWriter,
} from "@frt/api/api/websocket/websocket-broadcaster-service.ts";

export function makeWebSocketBroadcasterTestHarness() {
  return E.gen(function* () {
    const clientCount = yield* Ref.make(0);
    const latestMessage = yield* Ref.make<string | undefined>(undefined);
    const messages = yield* Ref.make<ReadonlyArray<string>>([]);

    const webSocketBroadcaster = {
      clientCount: Ref.get(clientCount),

      publish: (message: string) => {
        return E.gen(function* () {
          yield* Ref.set(latestMessage, message);

          yield* Ref.update(messages, (currentMessages) => {
            return [...currentMessages, message];
          });
        });
      },

      registerClient: () => {
        return E.acquireRelease(
          Ref.update(clientCount, (count) => {
            return count + 1;
          }),
          () => {
            return Ref.update(clientCount, (count) => {
              return count - 1;
            });
          },
        );
      },

      sendLatestToClient: (writer: WebSocketWriter) => {
        return E.gen(function* () {
          const message = yield* Ref.get(latestMessage);

          if (message === undefined) {
            return;
          }

          yield* writer(message).pipe(E.ignore);
        });
      },
    } satisfies WebSocketBroadcasterService;

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
