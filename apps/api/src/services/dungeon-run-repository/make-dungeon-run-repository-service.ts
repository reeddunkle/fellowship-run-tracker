import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";

import { type DungeonRunRepositoryShape } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { type DungeonRunStatusSchema } from "@frt/api-contract/validation/dungeon-run/dungeon-run-status-schema.ts";
import { DungeonRunDAO } from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { FellowshipLogsDungeonRunDAO } from "@frt/db/daos/fellowship-logs-dungeon-run/fellowship-logs-dungeon-run-dao.ts";
import { LocalLogDungeonRunDAO } from "@frt/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import { type DungeonRunId } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";

type FinishedDungeonRunStatus = Exclude<
  typeof DungeonRunStatusSchema.Type,
  "ACTIVE"
>;

export const makeDungeonRunRepository = E.gen(function* () {
  const dungeonRunDAO = yield* DungeonRunDAO;
  const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;
  const fellowshipLogsDungeonRunDAO = yield* FellowshipLogsDungeonRunDAO;
  const localLogDungeonRunDAO = yield* LocalLogDungeonRunDAO;
  const sql = yield* MainDatabase;

  const createLocal: DungeonRunRepositoryShape["createLocal"] = E.fn(
    "DungeonRunRepository.createLocal",
  )(
    function* ({ dungeonId, dungeonLevel }) {
      const dungeonRun = yield* dungeonRunDAO.create({
        dungeonId,
        dungeonLevel,
        endedAt: null,
        isOwnRun: true,
        source: "LOCAL_LOG",
        startedAt: null,
      });

      yield* localLogDungeonRunDAO.create({
        dungeonRunId: dungeonRun.id,
      });

      return dungeonRun;
    },
    (effect) => {
      return sql.withTransaction(effect);
    },
  );

  const importFellowshipLogs: DungeonRunRepositoryShape["createFellowshipLogsDungeonRun"] =
    E.fn("DungeonRunRepository.createFellowshipLogsDungeonRun")(
      function* ({
        dungeonId,
        dungeonLevel,
        endedAt,
        fightId,
        isOwnRun,
        observations,
        reportCode,
        startedAt,
      }) {
        const dungeonRun = yield* dungeonRunDAO.create({
          dungeonId,
          dungeonLevel,
          endedAt,
          isOwnRun,
          source: "FELLOWSHIP_LOGS",
          startedAt,
        });

        yield* fellowshipLogsDungeonRunDAO.create({
          dungeonRunId: dungeonRun.id,
          fightId,
          reportCode,
        });

        yield* E.forEach(
          observations,
          (observation) => {
            return dungeonRunObservationDAO.observe({
              dungeonRunId: dungeonRun.id,
              observedAt: observation.observedAt,
              targetId: observation.targetId,
              type: observation.type,
            });
          },
          {
            discard: true,
          },
        );

        return dungeonRun;
      },
      (effect) => {
        return sql.withTransaction(effect);
      },
    );

  const startLocal: DungeonRunRepositoryShape["startLocal"] = E.fn(
    "DungeonRunRepository.startLocal",
  )(function* ({ dungeonRunId, startedAt }) {
    return yield* dungeonRunDAO.start({
      dungeonRunId,
      startedAt,
    });
  });

  const finishLocal = E.fnUntraced(
    function* ({
      dungeonRunId,
      endedAt,
      status,
    }: {
      readonly dungeonRunId: DungeonRunId;
      readonly endedAt: DateTime.Utc;
      readonly status: FinishedDungeonRunStatus;
    }) {
      yield* dungeonRunDAO.end({
        dungeonRunId,
        endedAt,
      });

      yield* status === "COMPLETED"
        ? localLogDungeonRunDAO.complete({
            dungeonRunId,
          })
        : status === "EXITED"
          ? localLogDungeonRunDAO.exit({
              dungeonRunId,
            })
          : localLogDungeonRunDAO.interrupt({
              dungeonRunId,
            });
    },
    (effect) => {
      return sql.withTransaction(effect);
    },
  );

  const completeLocal: DungeonRunRepositoryShape["completeLocal"] = E.fn(
    "DungeonRunRepository.completeLocal",
  )(function* ({ dungeonRunId, endedAt }) {
    return yield* finishLocal({
      dungeonRunId,
      endedAt,
      status: "COMPLETED",
    });
  });

  const exitLocal: DungeonRunRepositoryShape["exitLocal"] = E.fn(
    "DungeonRunRepository.exitLocal",
  )(function* ({ dungeonRunId, endedAt }) {
    return yield* finishLocal({
      dungeonRunId,
      endedAt,
      status: "EXITED",
    });
  });

  const interruptLocal: DungeonRunRepositoryShape["interruptLocal"] = E.fn(
    "DungeonRunRepository.interruptLocal",
  )(function* ({ dungeonRunId, endedAt }) {
    return yield* finishLocal({
      dungeonRunId,
      endedAt,
      status: "INTERRUPTED",
    });
  });

  const getUnfinishedLocalRunEndedAt = E.fn(
    "DungeonRunRepository.getUnfinishedLocalRunEndedAt",
  )(function* (dungeonRunId: DungeonRunId) {
    const dungeonRun = yield* dungeonRunDAO.getById({
      id: dungeonRunId,
    });

    if (Option.isNone(dungeonRun)) {
      return Option.none<DateTime.Utc>();
    }

    const observations = yield* dungeonRunObservationDAO.getByDungeonRunId({
      dungeonRunId,
    });

    const observedAts = observations.map((observation) => {
      return observation.observedAt;
    });

    return Option.some(
      A.isArrayNonEmpty(observedAts)
        ? A.max(observedAts, DateTime.Order)
        : (dungeonRun.value.startedAt ?? dungeonRun.value.createdAt),
    );
  });

  const interruptUnfinishedLocal: DungeonRunRepositoryShape["interruptUnfinishedLocal"] =
    E.fn("DungeonRunRepository.interruptUnfinishedLocal")(function* ({
      createdBefore,
    }) {
      const unfinishedRuns = yield* localLogDungeonRunDAO.listActive({
        createdBefore,
      });

      const interruptions = yield* E.forEach(
        unfinishedRuns,
        ({ dungeonRunId }) => {
          return getUnfinishedLocalRunEndedAt(dungeonRunId).pipe(
            E.map(
              Option.map((endedAt) => {
                return { dungeonRunId, endedAt };
              }),
            ),
          );
        },
        { concurrency: "unbounded" },
      ).pipe(E.map(A.getSomes));

      yield* E.forEach(interruptions, interruptLocal, { discard: true });

      return interruptions.map(({ dungeonRunId }) => {
        return dungeonRunId;
      });
    });

  const delete_: DungeonRunRepositoryShape["delete"] = E.fn(
    "DungeonRunRepository.delete",
  )(function* ({ dungeonRunId }) {
    return yield* dungeonRunDAO.delete({
      dungeonRunId,
    });
  });

  const deleteHistory: DungeonRunRepositoryShape["deleteHistory"] = E.fn(
    "DungeonRunRepository.deleteHistory",
  )(function* ({ dungeonId, dungeonLevel }) {
    return yield* dungeonRunDAO.deleteByDungeon({
      dungeonId,
      dungeonLevel,
      isOwnRun: true,
    });
  });

  const getFellowshipLogsDungeonRun: DungeonRunRepositoryShape["getFellowshipLogsDungeonRun"] =
    E.fn("DungeonRunRepository.getFellowshipLogsDungeonRun")(
      function* (options) {
        return yield* fellowshipLogsDungeonRunDAO.getByReportFight(options);
      },
    );

  const listFellowshipLogsDungeonRuns: DungeonRunRepositoryShape["listFellowshipLogsDungeonRuns"] =
    E.fn("DungeonRunRepository.listFellowshipLogsDungeonRuns")(function* () {
      return yield* fellowshipLogsDungeonRunDAO.listImported();
    });

  return {
    completeLocal,
    createFellowshipLogsDungeonRun: importFellowshipLogs,
    createLocal,
    delete: delete_,
    deleteHistory,
    exitLocal,
    getFellowshipLogsDungeonRun,
    interruptLocal,
    interruptUnfinishedLocal,
    listFellowshipLogsDungeonRuns,
    startLocal,
  } satisfies DungeonRunRepositoryShape;
});
