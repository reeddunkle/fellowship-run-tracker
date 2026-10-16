import { type QueryClient } from "@tanstack/react-query";
import * as E from "effect/Effect";
import type * as Stream from "effect/Stream";
import type * as Socket from "effect/socket/Socket";

import { type DungeonRunStateApi } from "@frt/api-contract/websocket/dungeon-run/dungeon-run-api-message-schema.ts";

import {
  type DungeonRunEventStreamError,
  type DungeonRunEventStreamEvent,
  makeDungeonRunEventStream,
} from "@/renderer/api/dungeon-run/dungeon-run-event-stream.ts";
import { invalidateDungeonRunHistory } from "@/renderer/api/fellowship-logs/fellowship-logs-invalidation.ts";
import { queryClient as defaultQueryClient } from "@/renderer/query/query-client.ts";
import {
  type ApiEventStoreSnapshot,
  type ManualApiEventStore,
  makeApiEventStore,
} from "@/renderer/stores/make-api-event-store.ts";

type DungeonRunEventState = {
  readonly runState: DungeonRunStateApi | null;
};

export type DungeonRunEventStoreSnapshot =
  ApiEventStoreSnapshot<DungeonRunEventState>;

type DungeonRunEventStreamFactory = () => Stream.Stream<
  DungeonRunEventStreamEvent,
  DungeonRunEventStreamError,
  Socket.WebSocketConstructor
>;

export type MakeDungeonRunEventStoreOptions = {
  readonly makeEventStream?: DungeonRunEventStreamFactory;
  readonly queryClient?: QueryClient;
};

export type DungeonRunEventStore =
  ManualApiEventStore<DungeonRunEventStoreSnapshot>;

const initialState: DungeonRunEventState = {
  runState: null,
};

export function makeDungeonRunEventStore({
  makeEventStream = makeDungeonRunEventStream,
  queryClient = defaultQueryClient,
}: MakeDungeonRunEventStoreOptions = {}): DungeonRunEventStore {
  return makeApiEventStore({
    initialState,
    label: "Dungeon run",
    lifecycle: "manual",
    makeEventStream,
    onMessage: ({ next, previous }) => {
      const previousStatus = previous.runState?.dungeonRun?.status;
      const nextStatus = next.runState?.dungeonRun?.status;

      if (previousStatus !== "ACTIVE" || nextStatus === "ACTIVE") {
        return E.void;
      }

      return invalidateDungeonRunHistory(queryClient).pipe(
        E.catch((error) => {
          return E.logWarning(
            "Failed to refresh dungeon run history after a run finished.",
            {
              error,
            },
          );
        }),
      );
    },
    reduce: (state, message) => {
      return {
        ...state,
        runState: message.state,
      };
    },
  });
}

export const dungeonRunEventStore = makeDungeonRunEventStore();
