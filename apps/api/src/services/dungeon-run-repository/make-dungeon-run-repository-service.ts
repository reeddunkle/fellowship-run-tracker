import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { type DungeonRunRepositoryShape } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { type DungeonRunStatusSchema } from "@frt/api-contract/validation/dungeon-run/dungeon-run-status-schema.ts";
import { DungeonRunDAO } from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { FellowshipLogsDungeonRunDAO } from "@frt/db/daos/fellowship-logs-dungeon-run/fellowship-logs-dungeon-run-dao.ts";
import { LocalLogDungeonRunDAO } from "@frt/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import { type DungeonRunId } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";

type FinishedDungeonRunStatus = Exclude<
  typeof DungeonRunStatusSchema.Type,
  "ACTIVE"
>;

export const makeDungeonRunRepository = E.gen(function* () {
  const dungeonRunDAO = yield* DungeonRunDAO;
  const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;
  const fellowshipLogsDungeonRunDAO = yield* FellowshipLogsDungeonRunDAO;
  const localLogDungeonRunDAO = yield* LocalLogDungeonRunDAO;
  const sql = yield* SqlClient.SqlClient;

  const createLocal: DungeonRunRepositoryShape["createLocal"] = ({
    dungeonId,
    dungeonLevel,
  }) => {
    return sql.withTransaction(
      E.gen(function* () {
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
      }),
    );
  };

  const importFellowshipLogs: DungeonRunRepositoryShape["createFellowshipLogsDungeonRun"] =
    ({
      dungeonId,
      dungeonLevel,
      endedAt,
      fightId,
      isOwnRun,
      observations,
      reportCode,
      startedAt,
    }) => {
      return sql.withTransaction(
        E.gen(function* () {
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
        }),
      );
    };

  const startLocal: DungeonRunRepositoryShape["startLocal"] = ({
    dungeonRunId,
    startedAt,
  }) => {
    return dungeonRunDAO.start({
      dungeonRunId,
      startedAt,
    });
  };

  const finishLocal = E.fn("DungeonRunRepository.finishLocal")(function* ({
    dungeonRunId,
    endedAt,
    status,
  }: {
    readonly dungeonRunId: DungeonRunId;
    readonly endedAt: DateTime.Utc;
    readonly status: FinishedDungeonRunStatus;
  }) {
    yield* sql.withTransaction(
      E.gen(function* () {
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
      }),
    );
  });

  const completeLocal: DungeonRunRepositoryShape["completeLocal"] = ({
    dungeonRunId,
    endedAt,
  }) => {
    return finishLocal({
      dungeonRunId,
      endedAt,
      status: "COMPLETED",
    });
  };

  const exitLocal: DungeonRunRepositoryShape["exitLocal"] = ({
    dungeonRunId,
    endedAt,
  }) => {
    return finishLocal({
      dungeonRunId,
      endedAt,
      status: "EXITED",
    });
  };

  const interruptLocal: DungeonRunRepositoryShape["interruptLocal"] = ({
    dungeonRunId,
    endedAt,
  }) => {
    return finishLocal({
      dungeonRunId,
      endedAt,
      status: "INTERRUPTED",
    });
  };

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

  const delete_: DungeonRunRepositoryShape["delete"] = ({ dungeonRunId }) => {
    return dungeonRunDAO.delete({
      dungeonRunId,
    });
  };

  const deleteHistory: DungeonRunRepositoryShape["deleteHistory"] = ({
    dungeonId,
    dungeonLevel,
  }) => {
    return dungeonRunDAO.deleteByDungeon({
      dungeonId,
      dungeonLevel,
      isOwnRun: true,
    });
  };

  const getFellowshipLogsDungeonRun: DungeonRunRepositoryShape["getFellowshipLogsDungeonRun"] =
    (options) => {
      return fellowshipLogsDungeonRunDAO.getByReportFight(options);
    };

  const listFellowshipLogsDungeonRuns: DungeonRunRepositoryShape["listFellowshipLogsDungeonRuns"] =
    () => {
      return fellowshipLogsDungeonRunDAO.listImported();
    };

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
