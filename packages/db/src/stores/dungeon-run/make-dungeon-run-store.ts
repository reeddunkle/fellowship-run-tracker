import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";

import { DungeonRunDAO } from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { FellowshipLogsDungeonRunDAO } from "@frt/db/daos/fellowship-logs-dungeon-run/fellowship-logs-dungeon-run-dao.ts";
import { LocalLogDungeonRunDAO } from "@frt/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import {
  type DungeonRunStoreObservation,
  type DungeonRunStoreShape,
} from "@frt/db/stores/dungeon-run/dungeon-run-store.ts";
import { type DungeonRunId } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";

export const makeDungeonRunStore = E.gen(function* () {
  const dungeonRunDAO = yield* DungeonRunDAO;
  const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;
  const fellowshipLogsDungeonRunDAO = yield* FellowshipLogsDungeonRunDAO;
  const localLogDungeonRunDAO = yield* LocalLogDungeonRunDAO;
  const sql = yield* MainDatabase;

  const insertObservations = E.fnUntraced(function* ({
    dungeonRunId,
    observations,
  }: {
    readonly dungeonRunId: DungeonRunId;
    readonly observations: ReadonlyArray<DungeonRunStoreObservation>;
  }) {
    yield* E.forEach(
      observations,
      ({ observedAt, targetId, type }) => {
        return dungeonRunObservationDAO.observe({
          dungeonRunId,
          observedAt,
          targetId,
          type,
        });
      },
      {
        discard: true,
      },
    );
  });

  const createLocal: DungeonRunStoreShape["createLocal"] = E.fn(
    "DungeonRunStore.createLocal",
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

  const startLocal: DungeonRunStoreShape["startLocal"] = E.fn(
    "DungeonRunStore.startLocal",
  )(function* ({ dungeonRunId, startedAt }) {
    return yield* dungeonRunDAO.start({
      dungeonRunId,
      startedAt,
    });
  });

  const observeLocal: DungeonRunStoreShape["observeLocal"] = E.fn(
    "DungeonRunStore.observeLocal",
  )(
    function* ({ dungeonRunId, observations }) {
      yield* insertObservations({
        dungeonRunId,
        observations,
      });
    },
    (effect) => {
      return sql.withTransaction(effect);
    },
  );

  const finishLocal: DungeonRunStoreShape["finishLocal"] = E.fn(
    "DungeonRunStore.finishLocal",
  )(
    function* ({ dungeonRunId, endedAt, status }) {
      yield* dungeonRunDAO.end({
        dungeonRunId,
        endedAt,
      });

      yield* localLogDungeonRunDAO.finish({
        dungeonRunId,
        status,
      });
    },
    (effect) => {
      return sql.withTransaction(effect);
    },
  );

  const getUnfinishedLocalRunEndedAt = E.fn(
    "DungeonRunStore.getUnfinishedLocalRunEndedAt",
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

  const interruptUnfinishedLocal: DungeonRunStoreShape["interruptUnfinishedLocal"] =
    E.fn("DungeonRunStore.interruptUnfinishedLocal")(function* ({
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

      yield* E.forEach(
        interruptions,
        ({ dungeonRunId, endedAt }) => {
          return finishLocal({
            dungeonRunId,
            endedAt,
            status: "INTERRUPTED",
          });
        },
        { discard: true },
      );

      return interruptions.map(({ dungeonRunId }) => {
        return dungeonRunId;
      });
    });

  const getLocal: DungeonRunStoreShape["getLocal"] = E.fn(
    "DungeonRunStore.getLocal",
  )(function* ({ dungeonRunId }) {
    const dungeonRun = yield* dungeonRunDAO.getById({
      id: dungeonRunId,
    });

    const localLogDungeonRun = yield* localLogDungeonRunDAO.getByDungeonRunId({
      dungeonRunId,
    });

    return Option.all({
      dungeonRun,
      localLogDungeonRun,
    }).pipe(
      Option.map((localRun) => {
        return {
          dungeonRun: localRun.dungeonRun,
          status: localRun.localLogDungeonRun.status,
        };
      }),
    );
  });

  const importFellowshipLogs: DungeonRunStoreShape["importFellowshipLogs"] =
    E.fn("DungeonRunStore.importFellowshipLogs")(
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

        yield* insertObservations({
          dungeonRunId: dungeonRun.id,
          observations,
        });

        return dungeonRun;
      },
      (effect) => {
        return sql.withTransaction(effect);
      },
    );

  const getFellowshipLogsRun: DungeonRunStoreShape["getFellowshipLogsRun"] =
    E.fn("DungeonRunStore.getFellowshipLogsRun")(function* (options) {
      return yield* fellowshipLogsDungeonRunDAO.getByReportFight(options);
    });

  const listFellowshipLogsRuns: DungeonRunStoreShape["listFellowshipLogsRuns"] =
    E.fn("DungeonRunStore.listFellowshipLogsRuns")(function* () {
      return yield* fellowshipLogsDungeonRunDAO.listImported();
    });

  const getHistory: DungeonRunStoreShape["getHistory"] = E.fn(
    "DungeonRunStore.getHistory",
  )(function* ({ dungeonId, dungeonLevel }) {
    return yield* dungeonRunObservationDAO.getHistoryByDungeon({
      dungeonId,
      dungeonLevel,
    });
  });

  const delete_: DungeonRunStoreShape["delete"] = E.fn(
    "DungeonRunStore.delete",
  )(function* ({ dungeonRunId }) {
    return yield* dungeonRunDAO.delete({
      dungeonRunId,
    });
  });

  const deleteHistory: DungeonRunStoreShape["deleteHistory"] = E.fn(
    "DungeonRunStore.deleteHistory",
  )(function* ({ dungeonId, dungeonLevel }) {
    return yield* dungeonRunDAO.deleteByDungeon({
      dungeonId,
      dungeonLevel,
      isOwnRun: true,
    });
  });

  return {
    createLocal,
    delete: delete_,
    deleteHistory,
    finishLocal,
    getFellowshipLogsRun,
    getHistory,
    getLocal,
    importFellowshipLogs,
    interruptUnfinishedLocal,
    listFellowshipLogsRuns,
    observeLocal,
    startLocal,
  } satisfies DungeonRunStoreShape;
});
