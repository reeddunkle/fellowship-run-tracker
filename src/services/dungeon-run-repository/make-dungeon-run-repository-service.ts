import type * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { DungeonRunDAO } from "@/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { LocalLogDungeonRunDAO } from "@/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import { FellowshipLogsDungeonRunDAO } from "@/db/fellowship-logs-dungeon-run/fellowship-logs-dungeon-run-dao.ts";
import { type DungeonRunRepositoryShape } from "@/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { type DungeonRunId } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";
import { type DungeonRunStatusSchema } from "@/validation/dungeon-run/dungeon-run-status-schema.ts";

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
    interruptLocal,
    listFellowshipLogsDungeonRuns,
    startLocal,
  } satisfies DungeonRunRepositoryShape;
});
