import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Semaphore from "effect/Semaphore";

import { publishDungeonRunState } from "@/api/websocket/dungeon-run/publish-dungeon-run-state.ts";
import { makeDungeonRunPersistence } from "@/application/dungeon-run-processing/dungeon-run-persistence.ts";
import { classifyTrackingFailure } from "@/application/fellowship-tracker/classify-tracking-failure.ts";
import { observeFellowshipLiveStatus } from "@/application/fellowship-tracker/observe-fellowship-live-status.ts";
import { ConfigurationDAO } from "@/db/daos/configuration/configuration-dao.ts";
import { DungeonRunDAO } from "@/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import {
  FellowshipTrackerAlreadyRunningError,
  FellowshipTrackerConfigurationNotFoundError,
} from "@/errors/fellowship-tracker-error.ts";
import { DungeonRunWebSocketBroadcaster } from "@/services/api/websocket-broadcaster-service.ts";
import {
  createInitialDungeonRunState,
  interruptDungeonRunProcessingState,
} from "@/services/fellowship/dungeon-runs/dungeon-run-processing-state.ts";
import { Fellowship } from "@/services/fellowship/fellowship-service.ts";

import { makeFellowshipTrackerEventProcessor } from "./fellowship-tracker-event-processor.ts";
import {
  type FellowshipTrackerServiceShape,
  type StartTrackingOptions,
} from "./fellowship-tracker-service-types.ts";
import { makeFellowshipTrackerState } from "./fellowship-tracker-state.ts";

export class FellowshipTracker extends Context.Service<
  FellowshipTracker,
  FellowshipTrackerServiceShape
>()(
  "fellowship-run-tracker/application/fellowship-tracker/fellowship-tracker-service/FellowshipTracker",
) {}

const make = E.gen(function* () {
  const configurationDAO = yield* ConfigurationDAO;
  const dungeonRunDAO = yield* DungeonRunDAO;
  const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;
  const dungeonRunWebSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;
  const fellowship = yield* Fellowship;
  const scope = yield* E.scope;

  const eventProcessor = yield* makeFellowshipTrackerEventProcessor;
  const trackerState = yield* makeFellowshipTrackerState();
  const semaphore = yield* Semaphore.make(1);

  const startTracking = E.fn("fellowship.tracker.start-tracking")(function* ({
    configuration,
    events,
    liveStatus,
    source,
  }: StartTrackingOptions) {
    yield* E.annotateCurrentSpan(
      "fellowship.dungeonId",
      configuration.dungeonId,
    );

    yield* E.annotateCurrentSpan("fellowship.tracker.source", source._tag);

    return yield* semaphore.withPermit(
      E.gen(function* () {
        const activeTracker = yield* trackerState.getActiveTracker;

        if (Option.isSome(activeTracker)) {
          return yield* new FellowshipTrackerAlreadyRunningError();
        }

        const dungeonRunPersistence =
          source._tag === "Persisted"
            ? yield* makeDungeonRunPersistence({
                configuration,
                configurationDefinitionId: source.configurationDefinitionId,
              }).pipe(
                E.provideService(DungeonRunDAO, dungeonRunDAO),
                E.provideService(
                  DungeonRunObservationDAO,
                  dungeonRunObservationDAO,
                ),
              )
            : undefined;

        const dungeonRunStateRef = yield* Ref.make(
          createInitialDungeonRunState(),
        );

        const processEventsEffect = eventProcessor.process({
          configuration,
          dungeonRunPersistence,
          dungeonRunStateRef,
          events,
        });

        const trackingStarted = yield* Deferred.make<void>();

        const runTrackingEffect = E.scoped(
          E.gen(function* () {
            if (liveStatus !== undefined) {
              yield* observeFellowshipLiveStatus({
                dungeonId: configuration.dungeonId,
                liveStatus,
                setTracking: () => {
                  return trackerState.setTracking({
                    dungeonId: configuration.dungeonId,
                    source,
                  });
                },
                setWaitingForLogFile: () => {
                  return trackerState.setWaitingForLogFile({
                    dungeonId: configuration.dungeonId,
                    source,
                  });
                },
                source,
              }).pipe(E.forkScoped);
            }

            yield* processEventsEffect;
          }),
        );

        const trackingEffect = Deferred.await(trackingStarted).pipe(
          E.andThen(runTrackingEffect),
          E.tap(() => {
            return trackerState.setIdle;
          }),
          E.catchCause((cause) => {
            if (Cause.hasInterruptsOnly(cause)) {
              return E.failCause(cause);
            }

            const failure = classifyTrackingFailure(cause);

            return trackerState
              .setFailed({
                dungeonId: configuration.dungeonId,
                failure,
                source,
              })
              .pipe(
                E.andThen(
                  E.logError("Fellowship tracker failed.", {
                    cause,
                    dungeonId: configuration.dungeonId,
                    failure,
                    source,
                  }),
                ),
                E.andThen(E.failCause(cause)),
              );
          }),
          E.ensuring(trackerState.clearActiveTracker),
        );

        const fiber = yield* E.forkIn(trackingEffect, scope);

        yield* trackerState.setActiveTracker({
          dungeonId: configuration.dungeonId,
          fiber,
          persistence: dungeonRunPersistence,
          source,
          stateRef: dungeonRunStateRef,
        });

        if (liveStatus === undefined) {
          yield* trackerState.setTracking({
            dungeonId: configuration.dungeonId,
            source,
          });
        } else {
          yield* trackerState.setWaitingForLogFile({
            dungeonId: configuration.dungeonId,
            source,
          });
        }

        /*
         * Do not allow the tracking fiber to begin until its active tracker
         * and initial status have been installed. Otherwise an immediately
         * failing stream could publish Failed and then have that status
         * overwritten by the startup path above.
         */
        yield* Deferred.succeed(trackingStarted, undefined);

        yield* E.logInfo("Started Fellowship tracker.", {
          dungeonId: configuration.dungeonId,
          milestoneCount: configuration.milestones.length,
          source,
        });

        return fiber;
      }),
    );
  });

  const start: FellowshipTrackerServiceShape["start"] = E.fn(
    "fellowship.tracker.start",
  )(function* ({ configurationId }) {
    yield* E.annotateCurrentSpan("fellowship.configurationId", configurationId);

    const persistedConfiguration = yield* configurationDAO.getById({
      id: configurationId,
    });

    if (Option.isNone(persistedConfiguration)) {
      return yield* new FellowshipTrackerConfigurationNotFoundError(
        configurationId,
      );
    }

    yield* startTracking({
      configuration: persistedConfiguration.value.configuration,
      events: fellowship.liveEvents(),
      liveStatus: fellowship.liveStatus(),
      source: {
        _tag: "Persisted",
        configurationDefinitionId:
          persistedConfiguration.value.configurationDefinitionId,
        configurationId,
      },
    });
  });

  const startConfiguration: FellowshipTrackerServiceShape["startConfiguration"] =
    E.fn("fellowship.tracker.start-configuration")(function* ({
      configuration,
    }) {
      yield* startTracking({
        configuration,
        events: fellowship.liveEvents(),
        liveStatus: fellowship.liveStatus(),
        source: {
          _tag: "External",
        },
      });
    });

  const stop: FellowshipTrackerServiceShape["stop"] = E.fn(
    "fellowship.tracker.stop",
  )(function* () {
    yield* semaphore.withPermit(
      E.gen(function* () {
        const activeTracker = yield* trackerState.getActiveTracker;

        if (Option.isNone(activeTracker)) {
          return;
        }

        const tracker = activeTracker.value;

        yield* E.annotateCurrentSpan("fellowship.dungeonId", tracker.dungeonId);

        yield* E.annotateCurrentSpan(
          "fellowship.tracker.source",
          tracker.source._tag,
        );

        /*
         * Interruption does not pass through the typed error channel used to
         * produce Failed. The tracking fiber's finalizer clears the active
         * tracker, while stop explicitly owns the transition back to Idle.
         */
        yield* Fiber.interrupt(tracker.fiber);
        yield* trackerState.setIdle;

        const currentState = yield* Ref.get(tracker.stateRef);

        if (currentState.dungeonRun?.status === "ACTIVE") {
          const endedAt = yield* DateTime.now;

          const interruptedState = interruptDungeonRunProcessingState({
            endedAt,
            state: currentState,
          });

          yield* Ref.set(tracker.stateRef, interruptedState);

          if (tracker.persistence !== undefined) {
            yield* tracker.persistence.interrupt(endedAt).pipe(
              E.catch((error) => {
                return E.logError(
                  "Failed to interrupt persisted dungeon run.",
                  {
                    error,
                  },
                );
              }),
            );
          }

          yield* publishDungeonRunState({
            state: interruptedState,
          }).pipe(
            E.provideService(
              DungeonRunWebSocketBroadcaster,
              dungeonRunWebSocketBroadcaster,
            ),
            E.catch((error) => {
              return E.logError(
                "Failed to publish interrupted dungeon run state.",
                {
                  error,
                },
              );
            }),
          );
        }

        yield* E.logInfo("Stopped Fellowship tracker.", {
          dungeonId: tracker.dungeonId,
          source: tracker.source,
        });
      }),
    );
  });

  const replayLog: FellowshipTrackerServiceShape["replayLog"] = E.fn(
    "fellowship.tracker.replay-log",
  )(function* ({ configuration, logFilePath }) {
    yield* E.annotateCurrentSpan("fellowship.log-file-path", logFilePath);

    const fiber = yield* startTracking({
      configuration,
      events: fellowship.streamEvents(logFilePath),
      source: {
        _tag: "External",
      },
    });

    yield* Fiber.join(fiber);
  });

  return {
    replayLog,
    start,
    startConfiguration,
    status: trackerState.status,
    statusChanges: trackerState.statusChanges,
    stop,
  } satisfies FellowshipTrackerServiceShape;
});

export const FellowshipTrackerLive = Layer.effect(FellowshipTracker, make);
