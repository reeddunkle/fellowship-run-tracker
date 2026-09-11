import type * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Semaphore from "effect/Semaphore";

import { DungeonRunDAO } from "@/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { type DungeonRunDAOError } from "@/errors/dungeon-run-dao-error.ts";
import { type DungeonRunObservationDAOError } from "@/errors/dungeon-run-observation-dao-error.ts";
import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";
import {
  DUNGEON_RUN_PROCESSING_EVENT,
  type DungeonRunProcessingEvent,
} from "@/services/fellowship/dungeon-runs/process-dungeon-run-event.ts";
import { type DungeonRunObservation } from "@/services/fellowship/requirements/process-requirement-event.ts";
import { type ConfigurationDefinitionId } from "@/validation/configuration/configuration-definition-id-schema.ts";
import { type DungeonRunId } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";

type DungeonRunPersistenceError =
  | DungeonRunDAOError
  | DungeonRunObservationDAOError;

type PersistDungeonRunEventResultOptions = {
  readonly observation: DungeonRunObservation | undefined;
  readonly processingEvents: ReadonlyArray<DungeonRunProcessingEvent>;
};

export type DungeonRunPersistence = {
  readonly interrupt: (
    endedAt: DateTime.Utc,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly persist: (
    options: PersistDungeonRunEventResultOptions,
  ) => E.Effect<void, DungeonRunPersistenceError>;
};

type MakeDungeonRunPersistenceOptions = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly configurationDefinitionId: ConfigurationDefinitionId;
};

function isLifecycleProcessingEvent(
  processingEvent: DungeonRunProcessingEvent,
): boolean {
  return (
    processingEvent.type === DUNGEON_RUN_PROCESSING_EVENT.RUN_STARTED ||
    processingEvent.type === DUNGEON_RUN_PROCESSING_EVENT.RUN_COMPLETED ||
    processingEvent.type === DUNGEON_RUN_PROCESSING_EVENT.RUN_EXITED
  );
}

export const makeDungeonRunPersistence = E.fn(
  "fellowship.dungeon-run.make-persistence",
)(function* ({
  configuration,
  configurationDefinitionId,
}: MakeDungeonRunPersistenceOptions) {
  const dungeonRunDAO = yield* DungeonRunDAO;
  const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;

  const dungeonRunIdRef = yield* Ref.make<Option.Option<DungeonRunId>>(
    Option.none(),
  );

  const dungeonRunIdSemaphore = yield* Semaphore.make(1);

  const getOrCreateDungeonRunId = E.fn(
    "fellowship.dungeon-run.get-or-create-id",
  )(function* () {
    return yield* dungeonRunIdSemaphore.withPermit(
      E.gen(function* () {
        const dungeonRunId = yield* Ref.get(dungeonRunIdRef);

        if (Option.isSome(dungeonRunId)) {
          return dungeonRunId.value;
        }

        const dungeonRun = yield* dungeonRunDAO.create({
          configurationDefinitionId,
          dungeonId: configuration.dungeonId,
          dungeonLevel: configuration.dungeonLevel,
        });

        yield* Ref.set(dungeonRunIdRef, Option.some(dungeonRun.id));

        return dungeonRun.id;
      }),
    );
  });

  const persistProcessingEvent = ({
    dungeonRunId,
    processingEvent,
  }: {
    readonly dungeonRunId: DungeonRunId;
    readonly processingEvent: DungeonRunProcessingEvent;
  }) => {
    return Match.value(processingEvent).pipe(
      Match.when(
        {
          type: DUNGEON_RUN_PROCESSING_EVENT.RUN_STARTED,
        },
        (runStartedEvent) => {
          return dungeonRunDAO.start({
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
          return dungeonRunDAO
            .complete({
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
          return dungeonRunDAO
            .exit({
              dungeonRunId,
              endedAt: runExitedEvent.timestamp,
            })
            .pipe(
              E.andThen(Ref.set(dungeonRunIdRef, Option.none<DungeonRunId>())),
            );
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
          return E.void;
        },
      ),
      Match.exhaustive,
    );
  };

  const persist: DungeonRunPersistence["persist"] = E.fn(
    "fellowship.dungeon-run.persist-event-result",
  )(function* ({ observation, processingEvents }) {
    const hasLifecycleEvent = processingEvents.some(isLifecycleProcessingEvent);

    if (observation === undefined && !hasLifecycleEvent) {
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
      processingEvents,
      (processingEvent) => {
        return persistProcessingEvent({
          dungeonRunId,
          processingEvent,
        });
      },
      {
        discard: true,
      },
    );
  });

  const interrupt: DungeonRunPersistence["interrupt"] = E.fn(
    "fellowship.dungeon-run.interrupt-persistence",
  )(function* (endedAt) {
    const dungeonRunId = yield* Ref.get(dungeonRunIdRef);

    if (Option.isNone(dungeonRunId)) {
      return;
    }

    yield* dungeonRunDAO.interrupt({
      dungeonRunId: dungeonRunId.value,
      endedAt,
    });

    yield* Ref.set(dungeonRunIdRef, Option.none<DungeonRunId>());
  });

  return {
    interrupt,
    persist,
  } satisfies DungeonRunPersistence;
});
