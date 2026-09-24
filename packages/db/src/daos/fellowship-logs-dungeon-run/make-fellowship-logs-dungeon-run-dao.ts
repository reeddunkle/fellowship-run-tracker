import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { type FellowshipLogsDungeonRunDAOShape } from "@frt/db/daos/fellowship-logs-dungeon-run/fellowship-logs-dungeon-run-dao.ts";
import { FellowshipLogsImportedDungeonRunRowSchema } from "@frt/db/daos/fellowship-logs-dungeon-run/fellowship-logs-imported-dungeon-run-row-schema.ts";
import { DungeonRunNotReturnedAfterInsertError } from "@frt/db/errors/dungeon-run-error.ts";
import { FellowshipLogsDungeonRunDAOError } from "@frt/db/errors/fellowship-logs-dungeon-run-dao-error.ts";
import { UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";
import { FellowshipLogsDungeonRunModel } from "@frt/db/models/fellowship-logs-dungeon-run-model.ts";

function mapFellowshipLogsDungeonRunDAOError(
  cause: unknown,
): FellowshipLogsDungeonRunDAOError {
  if (cause instanceof FellowshipLogsDungeonRunDAOError) {
    return cause;
  }

  return new FellowshipLogsDungeonRunDAOError({
    reason: new UnexpectedDatabaseError({ cause }),
  });
}

function decodeFellowshipLogsDungeonRunRows(
  rows: unknown,
): E.Effect<
  ReadonlyArray<FellowshipLogsDungeonRunModel>,
  FellowshipLogsDungeonRunDAOError
> {
  return Schema.decodeUnknownEffect(
    Schema.Array(FellowshipLogsDungeonRunModel),
  )(rows).pipe(E.mapError(mapFellowshipLogsDungeonRunDAOError));
}

export const makeFellowshipLogsDungeonRunDAO = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const getByDungeonRunId: FellowshipLogsDungeonRunDAOShape["getByDungeonRunId"] =
    ({ dungeonRunId }) => {
      return E.gen(function* () {
        const rows = yield* sql`
          SELECT
            dungeon_run_id,
            report_code,
            fight_id,
            created_at
          FROM
            fellowship_logs_dungeon_run
          WHERE
            dungeon_run_id = ${dungeonRunId}
          LIMIT
            1
        `;

        const fellowshipLogsDungeonRuns =
          yield* decodeFellowshipLogsDungeonRunRows(rows);

        const fellowshipLogsDungeonRun = fellowshipLogsDungeonRuns[0];

        return fellowshipLogsDungeonRun === undefined
          ? Option.none<FellowshipLogsDungeonRunModel>()
          : Option.some(fellowshipLogsDungeonRun);
      }).pipe(E.mapError(mapFellowshipLogsDungeonRunDAOError));
    };

  const getByReportFight: FellowshipLogsDungeonRunDAOShape["getByReportFight"] =
    ({ fightId, reportCode }) => {
      return E.gen(function* () {
        const rows = yield* sql`
          SELECT
            dungeon_run_id,
            report_code,
            fight_id,
            created_at
          FROM
            fellowship_logs_dungeon_run
          WHERE
            report_code = ${reportCode}
            AND fight_id = ${fightId}
          LIMIT
            1
        `;

        const fellowshipLogsDungeonRuns =
          yield* decodeFellowshipLogsDungeonRunRows(rows);

        const fellowshipLogsDungeonRun = fellowshipLogsDungeonRuns[0];

        return fellowshipLogsDungeonRun === undefined
          ? Option.none<FellowshipLogsDungeonRunModel>()
          : Option.some(fellowshipLogsDungeonRun);
      }).pipe(E.mapError(mapFellowshipLogsDungeonRunDAOError));
    };

  const create: FellowshipLogsDungeonRunDAOShape["create"] = ({
    dungeonRunId,
    fightId,
    reportCode,
  }) => {
    return E.gen(function* () {
      const fellowshipLogsDungeonRun =
        yield* FellowshipLogsDungeonRunModel.insert
          .makeEffect({
            dungeonRunId,
            fightId,
            reportCode,
          })
          .pipe(E.mapError(mapFellowshipLogsDungeonRunDAOError));

      const insert = yield* Schema.encodeEffect(
        FellowshipLogsDungeonRunModel.insert,
      )(fellowshipLogsDungeonRun).pipe(
        E.mapError(mapFellowshipLogsDungeonRunDAOError),
      );

      const rows = yield* sql`
        INSERT INTO
          fellowship_logs_dungeon_run (dungeon_run_id, report_code, fight_id, created_at)
        VALUES
          (
            ${insert.dungeonRunId},
            ${insert.reportCode},
            ${insert.fightId},
            ${insert.createdAt}
          )
        RETURNING
          dungeon_run_id,
          report_code,
          fight_id,
          created_at
      `;

      const fellowshipLogsDungeonRuns =
        yield* decodeFellowshipLogsDungeonRunRows(rows);

      const persistedFellowshipLogsDungeonRun = fellowshipLogsDungeonRuns[0];

      if (persistedFellowshipLogsDungeonRun === undefined) {
        return yield* new FellowshipLogsDungeonRunDAOError({
          reason: new DungeonRunNotReturnedAfterInsertError({ dungeonRunId }),
        });
      }

      return persistedFellowshipLogsDungeonRun;
    }).pipe(E.mapError(mapFellowshipLogsDungeonRunDAOError));
  };

  const listImported: FellowshipLogsDungeonRunDAOShape["listImported"] = () => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          flr.dungeon_run_id,
          dr.dungeon_id,
          d.name AS dungeon_name,
          dr.dungeon_level,
          flr.report_code,
          flr.fight_id,
          dr.started_at,
          dr.ended_at,
          flr.created_at AS imported_at
        FROM
          fellowship_logs_dungeon_run flr
          JOIN dungeon_run dr ON dr.id = flr.dungeon_run_id
          JOIN dungeon d ON d.id = dr.dungeon_id
        ORDER BY
          flr.created_at DESC
      `;

      return yield* Schema.decodeUnknownEffect(
        Schema.Array(FellowshipLogsImportedDungeonRunRowSchema),
      )(rows);
    }).pipe(E.mapError(mapFellowshipLogsDungeonRunDAOError));
  };

  return {
    create,
    getByDungeonRunId,
    getByReportFight,
    listImported,
  } satisfies FellowshipLogsDungeonRunDAOShape;
});
