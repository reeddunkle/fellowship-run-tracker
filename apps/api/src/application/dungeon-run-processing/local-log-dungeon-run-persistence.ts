import type * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Semaphore from "effect/Semaphore";

import {
  DUNGEON_RUN_PROCESSING_EVENT,
  type DungeonRunProcessingEvent,
} from "@frt/api/services/fellowship/dungeon-runs/process-dungeon-run-event.ts";
import { type DungeonRunObservation } from "@frt/api/services/fellowship/requirements/create-dungeon-run-observation.ts";
import {
  DungeonRunStore,
  type DungeonRunStoreError,
  type FinishedDungeonRunStatus,
} from "@frt/db/stores/dungeon-run/dungeon-run-store.ts";
import { type DungeonRunId } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";

type PersistLocalLogDungeonRunEventResultOptions = {
  readonly observation: DungeonRunObservation | undefined;
  readonly processingEvents: ReadonlyArray<DungeonRunProcessingEvent>;
};

type LocalLogDungeonRunLifecycleEvent = Extract<
  DungeonRunProcessingEvent,
  {
    readonly type:
      | typeof DUNGEON_RUN_PROCESSING_EVENT.RUN_COMPLETED
      | typeof DUNGEON_RUN_PROCESSING_EVENT.RUN_EXITED
      | typeof DUNGEON_RUN_PROCESSING_EVENT.RUN_STARTED;
  }
>;

const FINISHED_DUNGEON_RUN_STATUS_BY_EVENT_TYPE = {
  [DUNGEON_RUN_PROCESSING_EVENT.RUN_COMPLETED]: "COMPLETED",
  [DUNGEON_RUN_PROCESSING_EVENT.RUN_EXITED]: "EXITED",
} as const satisfies Record<
  Exclude<
    LocalLogDungeonRunLifecycleEvent["type"],
    typeof DUNGEON_RUN_PROCESSING_EVENT.RUN_STARTED
  >,
  FinishedDungeonRunStatus
>;

export type LocalLogDungeonRunPersistence = {
  readonly interrupt: (
    endedAt: DateTime.Utc,
  ) => E.Effect<void, DungeonRunStoreError>;

  readonly persist: (
    options: PersistLocalLogDungeonRunEventResultOptions,
  ) => E.Effect<void, DungeonRunStoreError>;
};

type MakeLocalLogDungeonRunPersistenceOptions = {
  readonly configuration: FellowshipMilestoneConfiguration;
};

function isLocalLogDungeonRunLifecycleEvent(
  processingEvent: DungeonRunProcessingEvent,
): processingEvent is LocalLogDungeonRunLifecycleEvent {
  return (
    processingEvent.type === DUNGEON_RUN_PROCESSING_EVENT.RUN_STARTED ||
    processingEvent.type === DUNGEON_RUN_PROCESSING_EVENT.RUN_COMPLETED ||
    processingEvent.type === DUNGEON_RUN_PROCESSING_EVENT.RUN_EXITED
  );
}

export const makeLocalLogDungeonRunPersistence = E.fnUntraced(function* ({
  configuration,
}: MakeLocalLogDungeonRunPersistenceOptions) {
  const dungeonRunStore = yield* DungeonRunStore;

  const dungeonRunIdRef = yield* Ref.make<Option.Option<DungeonRunId>>(
    Option.none(),
  );

  const dungeonRunIdSemaphore = yield* Semaphore.make(1);

  const getOrCreateDungeonRunId = E.fnUntraced(function* () {
    const dungeonRunId = yield* Ref.get(dungeonRunIdRef);

    if (Option.isSome(dungeonRunId)) {
      return dungeonRunId.value;
    }

    const dungeonRun = yield* dungeonRunStore.createLocal({
      dungeonId: configuration.dungeonId,
      dungeonLevel: configuration.dungeonLevel,
    });

    yield* Ref.set(dungeonRunIdRef, Option.some(dungeonRun.id));

    return dungeonRun.id;
  }, dungeonRunIdSemaphore.withPermit);

  const finishLocalRun = E.fnUntraced(function* (options: {
    readonly dungeonRunId: DungeonRunId;
    readonly endedAt: DateTime.Utc;
    readonly status: FinishedDungeonRunStatus;
  }) {
    yield* dungeonRunStore.finishLocal(options);

    yield* Ref.set(dungeonRunIdRef, Option.none<DungeonRunId>());
  });

  const persistLifecycleEvent = E.fn(
    "FellowshipTracker.persistLocalLogLifecycleEvent",
  )(function* ({
    dungeonRunId,
    processingEvent,
  }: {
    readonly dungeonRunId: DungeonRunId;
    readonly processingEvent: LocalLogDungeonRunLifecycleEvent;
  }) {
    yield* Match.value(processingEvent).pipe(
      Match.when(
        {
          type: DUNGEON_RUN_PROCESSING_EVENT.RUN_STARTED,
        },
        (runStartedEvent) => {
          return dungeonRunStore.startLocal({
            dungeonRunId,
            startedAt: runStartedEvent.timestamp,
          });
        },
      ),
      Match.orElse((runFinishedEvent) => {
        return finishLocalRun({
          dungeonRunId,
          endedAt: runFinishedEvent.timestamp,
          status:
            FINISHED_DUNGEON_RUN_STATUS_BY_EVENT_TYPE[runFinishedEvent.type],
        });
      }),
    );
  });

  const persist: LocalLogDungeonRunPersistence["persist"] = E.fnUntraced(
    function* ({ observation, processingEvents }) {
      const lifecycleEvents = processingEvents.filter(
        isLocalLogDungeonRunLifecycleEvent,
      );

      if (observation === undefined && lifecycleEvents.length === 0) {
        return;
      }

      const dungeonRunId = yield* getOrCreateDungeonRunId();

      if (observation !== undefined) {
        yield* dungeonRunStore.observeLocal({
          dungeonRunId,
          observations: [
            {
              observedAt: observation.timestamp,
              targetId: observation.targetId,
              type: observation.type,
            },
          ],
        });
      }

      yield* E.forEach(
        lifecycleEvents,
        (processingEvent) => {
          return persistLifecycleEvent({
            dungeonRunId,
            processingEvent,
          });
        },
        {
          discard: true,
        },
      );
    },
  );

  const interrupt: LocalLogDungeonRunPersistence["interrupt"] = E.fn(
    "FellowshipTracker.interruptLocalLogRun",
  )(function* (endedAt) {
    const dungeonRunId = yield* Ref.get(dungeonRunIdRef);

    if (Option.isNone(dungeonRunId)) {
      return;
    }

    yield* finishLocalRun({
      dungeonRunId: dungeonRunId.value,
      endedAt,
      status: "INTERRUPTED",
    });
  });

  return {
    interrupt,
    persist,
  } satisfies LocalLogDungeonRunPersistence;
});
