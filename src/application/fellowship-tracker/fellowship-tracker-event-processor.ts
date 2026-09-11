import * as E from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { publishDungeonRunState } from "@/api/websocket/dungeon-run/publish-dungeon-run-state.ts";
import { type DungeonRunPersistence } from "@/application/dungeon-run-processing/dungeon-run-persistence.ts";
import { handleLogDungeonRunEvent } from "@/application/dungeon-run-processing/handle-log-dungeon-run-event.ts";
import { DungeonRunWebSocketBroadcaster } from "@/services/api/websocket-broadcaster-service.ts";
import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";
import { type DungeonRunProcessingState } from "@/services/fellowship/dungeon-runs/dungeon-run-processing-state.ts";
import { processDungeonRunEventStream } from "@/services/fellowship/dungeon-runs/process-dungeon-run-event-stream.ts";
import { type FellowshipEvent } from "@/services/fellowship/validation/fellowship-event-schema.ts";
import { LiveSplit } from "@/services/live-split/core/live-split-service.ts";

type ProcessFellowshipTrackerEventsOptions = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly dungeonRunPersistence: DungeonRunPersistence | undefined;
  readonly dungeonRunStateRef: Ref.Ref<DungeonRunProcessingState>;
  readonly events: Stream.Stream<FellowshipEvent, unknown>;
};

export const makeFellowshipTrackerEventProcessor = E.gen(function* () {
  const dungeonRunWebSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;
  const liveSplit = yield* LiveSplit;

  const process = ({
    configuration,
    dungeonRunPersistence,
    dungeonRunStateRef,
    events,
  }: ProcessFellowshipTrackerEventsOptions) => {
    return processDungeonRunEventStream({
      configuration,
      events,
    }).pipe(
      Stream.runForEach((result) => {
        const updateStateEffect = Ref.set(dungeonRunStateRef, result.state);

        const hasRelevantResult =
          result.observation !== undefined ||
          result.processingEvents.length > 0;

        if (!hasRelevantResult) {
          return updateStateEffect;
        }

        const persistResultEffect =
          dungeonRunPersistence === undefined
            ? E.void
            : dungeonRunPersistence
                .persist({
                  observation: result.observation,
                  processingEvents: result.processingEvents,
                })
                .pipe(
                  E.catch((error) => {
                    return E.logError(
                      "Failed to persist dungeon run event result.",
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
            return handleLogDungeonRunEvent({
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
                publishStateEffect,
                persistResultEffect,
              ],
              {
                concurrency: "unbounded",
                discard: true,
              },
            ),
          ),
        );
      }),
    );
  };

  return {
    process,
  };
});
