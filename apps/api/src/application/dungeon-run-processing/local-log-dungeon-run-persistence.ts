import type * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Semaphore from "effect/Semaphore";

import {
  DungeonRunRepository,
  type DungeonRunRepositoryError,
} from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import {
  DUNGEON_RUN_PROCESSING_EVENT,
  type DungeonRunProcessingEvent,
} from "@frt/api/services/fellowship/dungeon-runs/process-dungeon-run-event.ts";
import { type DungeonRunObservation } from "@frt/api/services/fellowship/requirements/create-dungeon-run-observation.ts";
import { DungeonRunObservationDAO } from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { type DungeonRunObservationDAOError } from "@frt/db/errors/dungeon-run-observation-dao-error.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";
import { type DungeonRunId } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";

type LocalLogDungeonRunPersistenceError =
  | DungeonRunObservationDAOError
  | DungeonRunRepositoryError;

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

export type LocalLogDungeonRunPersistence = {
  readonly interrupt: (
    endedAt: DateTime.Utc,
  ) => E.Effect<void, LocalLogDungeonRunPersistenceError>;

  readonly persist: (
    options: PersistLocalLogDungeonRunEventResultOptions,
  ) => E.Effect<void, LocalLogDungeonRunPersistenceError>;
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

export const makeLocalLogDungeonRunPersistence = E.fn(
  "fellowship.local-log-dungeon-run.make-persistence",
)(function* ({ configuration }: MakeLocalLogDungeonRunPersistenceOptions) {
  const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;
  const dungeonRunRepository = yield* DungeonRunRepository;

  const dungeonRunIdRef = yield* Ref.make<Option.Option<DungeonRunId>>(
    Option.none(),
  );

  const dungeonRunIdSemaphore = yield* Semaphore.make(1);

  const getOrCreateDungeonRunId = E.fn(
    "fellowship.local-log-dungeon-run.get-or-create-id",
  )(function* () {
    return yield* dungeonRunIdSemaphore.withPermit(
      E.gen(function* () {
        const dungeonRunId = yield* Ref.get(dungeonRunIdRef);

        if (Option.isSome(dungeonRunId)) {
          return dungeonRunId.value;
        }

        const dungeonRun = yield* dungeonRunRepository.createLocal({
          dungeonId: configuration.dungeonId,
          dungeonLevel: configuration.dungeonLevel,
        });

        yield* Ref.set(dungeonRunIdRef, Option.some(dungeonRun.id));

        return dungeonRun.id;
      }),
    );
  });

  const persistLifecycleEvent = E.fn(
    "fellowship.local-log-dungeon-run.persist-lifecycle-event",
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
          return dungeonRunRepository.startLocal({
            dungeonRunId,
            startedAt: runStartedEvent.timestamp,
          });
        },
      ),
      Match.when(
        {
          type: DUNGEON_RUN_PROCESSING_EVENT.RUN_COMPLETED,
        },
        (runCompletedEvent) => {
          return dungeonRunRepository
            .completeLocal({
              dungeonRunId,
              endedAt: runCompletedEvent.timestamp,
            })
            .pipe(
              E.andThen(Ref.set(dungeonRunIdRef, Option.none<DungeonRunId>())),
            );
        },
      ),
      Match.when(
        {
          type: DUNGEON_RUN_PROCESSING_EVENT.RUN_EXITED,
        },
        (runExitedEvent) => {
          return dungeonRunRepository
            .exitLocal({
              dungeonRunId,
              endedAt: runExitedEvent.timestamp,
            })
            .pipe(
              E.andThen(Ref.set(dungeonRunIdRef, Option.none<DungeonRunId>())),
            );
        },
      ),
      Match.exhaustive,
    );
  });

  const persist: LocalLogDungeonRunPersistence["persist"] = E.fn(
    "fellowship.local-log-dungeon-run.persist-event-result",
  )(function* ({ observation, processingEvents }) {
    const lifecycleEvents = processingEvents.filter(
      isLocalLogDungeonRunLifecycleEvent,
    );

    if (observation === undefined && lifecycleEvents.length === 0) {
      return;
    }

    const dungeonRunId = yield* getOrCreateDungeonRunId();

    if (observation !== undefined) {
      yield* dungeonRunObservationDAO.observe({
        dungeonRunId,
        observedAt: observation.timestamp,
        targetId: observation.targetId,
        type: observation.type,
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
  });

  const interrupt: LocalLogDungeonRunPersistence["interrupt"] = E.fn(
    "fellowship.local-log-dungeon-run.interrupt-persistence",
  )(function* (endedAt) {
    const dungeonRunId = yield* Ref.get(dungeonRunIdRef);

    if (Option.isNone(dungeonRunId)) {
      return;
    }

    yield* dungeonRunRepository.interruptLocal({
      dungeonRunId: dungeonRunId.value,
      endedAt,
    });

    yield* Ref.set(dungeonRunIdRef, Option.none<DungeonRunId>());
  });

  return {
    interrupt,
    persist,
  } satisfies LocalLogDungeonRunPersistence;
});
