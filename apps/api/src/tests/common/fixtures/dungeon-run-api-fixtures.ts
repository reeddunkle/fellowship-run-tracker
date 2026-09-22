import {
  type DungeonRunApiMessage,
  type DungeonRunStateApi,
} from "@frt/api-contract/websocket/dungeon-run/dungeon-run-api-message-schema.ts";

export const MOCK_DUNGEON_RUN_STATE_API = {
  dungeonRun: {
    endedAtMilliseconds: null,
    startedAtMilliseconds: 1_000,
    status: "ACTIVE",
  },
  observations: [
    {
      targetId: "42",
      timestampMilliseconds: 10_000,
      type: "UNIT_DEATH",
    },
    {
      targetId: "634",
      timestampMilliseconds: 20_000,
      type: "ABILITY_ACTIVATED",
    },
  ],
} satisfies DungeonRunStateApi;

export const MOCK_DUNGEON_RUN_API_MESSAGE = {
  state: MOCK_DUNGEON_RUN_STATE_API,
  version: 1,
} satisfies DungeonRunApiMessage;
