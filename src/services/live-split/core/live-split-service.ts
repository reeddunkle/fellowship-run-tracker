import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import type * as Stream from "effect/Stream";

import { type LiveSplitConnectionError } from "@/errors/live-split-client-error.ts";
import {
  DUNGEON_RUN_PROCESSING_EVENT,
  type DungeonRunProcessingEvent,
} from "@/services/fellowship/dungeon-runs/process-dungeon-run-event.ts";
import {
  LiveSplitConnectionManager,
  type LiveSplitConnectionStatus,
} from "@/services/live-split/core/live-split-connection-manager-service.ts";

export type LiveSplitService = {
  readonly connect: () => E.Effect<void, LiveSplitConnectionError>;

  readonly disconnect: () => E.Effect<void>;

  readonly handleRunEvent: (event: DungeonRunProcessingEvent) => E.Effect<void>;

  readonly status: E.Effect<LiveSplitConnectionStatus>;

  readonly statusChanges: Stream.Stream<LiveSplitConnectionStatus>;
};

const makeLiveSplit = E.gen(function* () {
  const connectionManager = yield* LiveSplitConnectionManager;

  const handleRunEvent: LiveSplitService["handleRunEvent"] = (
    processingEvent,
  ) => {
    return E.gen(function* () {
      const client = yield* connectionManager.client;

      if (Option.isNone(client)) {
        return;
      }

      yield* Match.value(processingEvent).pipe(
        Match.when(
          {
            type: DUNGEON_RUN_PROCESSING_EVENT.RUN_STARTED,
          },
          () => {
            return E.gen(function* () {
              yield* client.value.reset();
              yield* client.value.startTimer();
            });
          },
        ),
        Match.when(
          {
            type: DUNGEON_RUN_PROCESSING_EVENT.REQUIREMENT_SATISFIED,
          },
          () => {
            return E.void;
          },
        ),
        Match.when(
          {
            type: DUNGEON_RUN_PROCESSING_EVENT.MILESTONE_COMPLETED,
          },
          () => {
            return client.value.split();
          },
        ),
        Match.when(
          {
            type: DUNGEON_RUN_PROCESSING_EVENT.RUN_COMPLETED,
          },
          () => {
            return client.value.pause();
          },
        ),
        Match.when(
          {
            type: DUNGEON_RUN_PROCESSING_EVENT.RUN_EXITED,
          },
          () => {
            return client.value.pause();
          },
        ),
        Match.exhaustive,
      );
    }).pipe(
      E.catch((error) => {
        return E.gen(function* () {
          yield* E.logError("LiveSplit failed to handle dungeon run event.", {
            error,
          });

          yield* connectionManager.disconnect();
        });
      }),
    );
  };

  return {
    connect: connectionManager.connect,
    disconnect: connectionManager.disconnect,
    handleRunEvent,
    status: connectionManager.status,
    statusChanges: connectionManager.statusChanges,
  } satisfies LiveSplitService;
});

export class LiveSplit extends Context.Service<LiveSplit, LiveSplitService>()(
  "fellowship-run-tracker/services/live-split/core/live-split-service/LiveSplit",
) {
  static readonly layerNoDeps = Layer.effect(this, makeLiveSplit);

  static readonly layerWith = (options: {
    readonly encryptionKeyDirectory: string;
  }) => {
    return this.layerNoDeps.pipe(
      Layer.provide(LiveSplitConnectionManager.layerWith(options)),
    );
  };
}
