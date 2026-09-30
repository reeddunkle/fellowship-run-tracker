import type * as Stream from "effect/Stream";
import type * as Socket from "effect/socket/Socket";

import { ROUTES } from "@frt/api-contract/constants/routes.ts";
import {
  type DungeonRunApiMessage,
  DungeonRunApiMessageSchema,
} from "@frt/api-contract/websocket/dungeon-run/dungeon-run-api-message-schema.ts";

import { DungeonRunEventMessageDecodeError } from "@/errors/dungeon-run-event-message-error.ts";
import {
  type ApiEventStreamError,
  type ApiEventStreamEvent,
  makeApiEventStream,
} from "@/renderer/api/make-api-event-stream.ts";
import { getApiWebSocketUrl } from "@/renderer/services/app-api-client/api-url.ts";

export type DungeonRunEventStreamEvent =
  ApiEventStreamEvent<DungeonRunApiMessage>;

export type DungeonRunEventStreamError =
  ApiEventStreamError<DungeonRunEventMessageDecodeError>;

export function makeDungeonRunEventStream(): Stream.Stream<
  DungeonRunEventStreamEvent,
  DungeonRunEventStreamError,
  Socket.WebSocketConstructor
> {
  return makeApiEventStream({
    connectionLostMessage:
      "Lost connection to the dungeon run event stream; retrying.",
    makeDecodeError: (cause) => {
      return new DungeonRunEventMessageDecodeError({
        cause,
      });
    },
    schema: DungeonRunApiMessageSchema,
    url: getApiWebSocketUrl(ROUTES.dungeonRunEvents),
  });
}
