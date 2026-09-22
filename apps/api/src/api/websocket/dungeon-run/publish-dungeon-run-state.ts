import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import { createDungeonRunApiState } from "@frt/api/api/websocket/dungeon-run/dungeon-run-api-state.ts";
import { DungeonRunWebSocketBroadcaster } from "@frt/api/services/api/websocket-broadcaster-service.ts";
import { type DungeonRunProcessingState } from "@frt/api/services/fellowship/dungeon-runs/dungeon-run-processing-state.ts";
import {
  type DungeonRunApiMessage,
  DungeonRunApiMessageSchema,
} from "@frt/api-contract/websocket/dungeon-run/dungeon-run-api-message-schema.ts";

type PublishDungeonRunStateOptions = {
  readonly state: DungeonRunProcessingState;
};

const DungeonRunApiMessageFromJsonStringSchema = Schema.fromJsonString(
  DungeonRunApiMessageSchema,
);

function createDungeonRunApiMessage({
  state,
}: PublishDungeonRunStateOptions): DungeonRunApiMessage {
  return {
    state: createDungeonRunApiState({
      state,
    }),
    version: 1,
  };
}

export const publishDungeonRunState = E.fn(
  "fellowship.dungeon-run.publish-state",
)(function* ({ state }: PublishDungeonRunStateOptions) {
  const webSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;

  const message = createDungeonRunApiMessage({
    state,
  });

  const encodedMessage = yield* Schema.encodeEffect(
    DungeonRunApiMessageFromJsonStringSchema,
  )(message);

  yield* webSocketBroadcaster.publish(encodedMessage);
});
