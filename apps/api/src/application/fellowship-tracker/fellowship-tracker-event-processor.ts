import * as E from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { publishDungeonRunState } from "@frt/api/api/websocket/dungeon-run/publish-dungeon-run-state.ts";
import { DungeonRunWebSocketBroadcaster } from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { type LocalLogDungeonRunPersistence } from "@frt/api/application/dungeon-run-processing/local-log-dungeon-run-persistence.ts";
import { logDungeonRunProcessingEvent } from "@frt/api/application/dungeon-run-processing/log-dungeon-run-processing-event.ts";
import { type DungeonRunProcessingState } from "@frt/api/services/fellowship/dungeon-runs/dungeon-run-processing-state.ts";
import {
  type ProcessDungeonRunEventStreamResult,
  processDungeonRunEventStream,
} from "@frt/api/services/fellowship/dungeon-runs/process-dungeon-run-event-stream.ts";
import { LiveSplit } from "@frt/api/services/live-split/core/live-split-service.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

type ProcessFellowshipTrackerEventsOptions = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly dungeonRunStateRef: Ref.Ref<DungeonRunProcessingState>;
  readonly events: Stream.Stream<FellowshipEvent, unknown>;
  readonly localLogDungeonRunPersistence:
    | LocalLogDungeonRunPersistence
    | undefined;
};

export const makeFellowshipTrackerEventProcessor = E.gen(function* () {
  const dungeonRunWebSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;
  const liveSplit = yield* LiveSplit;

  function handleProcessedDungeonRunEvent({
    dungeonRunStateRef,
    localLogDungeonRunPersistence,
    result,
  }: {
    readonly dungeonRunStateRef: Ref.Ref<DungeonRunProcessingState>;
    readonly localLogDungeonRunPersistence:
      | LocalLogDungeonRunPersistence
      | undefined;
    readonly result: ProcessDungeonRunEventStreamResult;
  }) {
    const updateStateEffect = Ref.set(dungeonRunStateRef, result.state);

    const hasRelevantResult =
      result.observation !== undefined || result.processingEvents.length > 0;

    if (!hasRelevantResult) {
      return updateStateEffect;
    }

    const persistResultEffect =
      localLogDungeonRunPersistence === undefined
        ? E.void
        : localLogDungeonRunPersistence
            .persist({
              observation: result.observation,
              processingEvents: result.processingEvents,
            })
            .pipe(
              E.catch((error) => {
                return E.logError(
                  "Failed to persist local log dungeon run event result.",
                  {
                    error,
                  },
                );
              }),
            );

    const sendLiveSplitCommandsEffect = E.forEach(
      result.processingEvents,
      (processingEvent) => {
        return liveSplit.handleRunEvent(processingEvent);
      },
      {
        discard: true,
      },
    );

    const logEffects = E.forEach(
      result.processingEvents,
      (processingEvent) => {
        return logDungeonRunProcessingEvent({
          processingEvent,
        });
      },
      {
        discard: true,
      },
    );

    const publishStateEffect = publishDungeonRunState({
      state: result.state,
    }).pipe(
      E.provideService(
        DungeonRunWebSocketBroadcaster,
        dungeonRunWebSocketBroadcaster,
      ),
    );

    return updateStateEffect.pipe(
      E.andThen(
        E.all(
          [
            logEffects,
            sendLiveSplitCommandsEffect,
            persistResultEffect,
            publishStateEffect,
          ],
          {
            concurrency: "unbounded",
            discard: true,
          },
        ),
      ),
    );
  }

  function process({
    configuration,
    dungeonRunStateRef,
    events,
    localLogDungeonRunPersistence,
  }: ProcessFellowshipTrackerEventsOptions) {
    return processDungeonRunEventStream({
      configuration,
      events,
    }).pipe(
      Stream.runForEach((result) => {
        return handleProcessedDungeonRunEvent({
          dungeonRunStateRef,
          localLogDungeonRunPersistence,
          result,
        });
      }),
    );
  }

  return {
    process,
  };
});
