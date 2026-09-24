import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { type DungeonRunStatusSchema } from "@frt/api-contract/validation/dungeon-run/dungeon-run-status-schema.ts";
import { type LocalLogDungeonRunDAOShape } from "@frt/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import {
  DungeonRunNotFoundOrInactiveError,
  DungeonRunNotReturnedAfterInsertError,
} from "@frt/db/errors/dungeon-run-error.ts";
import { LocalLogDungeonRunDAOError } from "@frt/db/errors/local-log-dungeon-run-dao-error.ts";
import { UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";
import { LocalLogDungeonRunModel } from "@frt/db/models/local-log-dungeon-run-model.ts";
import { type DungeonRunId } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";

type DungeonRunStatus = typeof DungeonRunStatusSchema.Type;

function mapLocalLogDungeonRunDAOError(
  cause: unknown,
): LocalLogDungeonRunDAOError {
  if (cause instanceof LocalLogDungeonRunDAOError) {
    return cause;
  }

  return new LocalLogDungeonRunDAOError({
    reason: new UnexpectedDatabaseError({ cause }),
  });
}

function decodeLocalLogDungeonRunRows(
  rows: unknown,
): E.Effect<
  ReadonlyArray<LocalLogDungeonRunModel>,
  LocalLogDungeonRunDAOError
> {
  return Schema.decodeUnknownEffect(Schema.Array(LocalLogDungeonRunModel))(
    rows,
  ).pipe(E.mapError(mapLocalLogDungeonRunDAOError));
}

function makeRunNotFoundOrInactiveError(
  dungeonRunId: DungeonRunId,
): LocalLogDungeonRunDAOError {
  return new LocalLogDungeonRunDAOError({
    reason: new DungeonRunNotFoundOrInactiveError({ dungeonRunId }),
  });
}

export const makeLocalLogDungeonRunDAO = E.gen(function* () {
  const sql = yield* MainDatabase;

  const getByDungeonRunId: LocalLogDungeonRunDAOShape["getByDungeonRunId"] = ({
    dungeonRunId,
  }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          dungeon_run_id,
          status,
          created_at,
          updated_at
        FROM
          local_log_dungeon_run
        WHERE
          dungeon_run_id = ${dungeonRunId}
        LIMIT
          1
      `;

      const localLogDungeonRuns = yield* decodeLocalLogDungeonRunRows(rows);

      const localLogDungeonRun = localLogDungeonRuns[0];

      return localLogDungeonRun === undefined
        ? Option.none<LocalLogDungeonRunModel>()
        : Option.some(localLogDungeonRun);
    }).pipe(E.mapError(mapLocalLogDungeonRunDAOError));
  };

  const create: LocalLogDungeonRunDAOShape["create"] = ({ dungeonRunId }) => {
    return E.gen(function* () {
      const localLogDungeonRun = yield* LocalLogDungeonRunModel.insert
        .makeEffect({
          dungeonRunId,
          status: "ACTIVE",
        })
        .pipe(E.mapError(mapLocalLogDungeonRunDAOError));

      const insert = yield* Schema.encodeEffect(LocalLogDungeonRunModel.insert)(
        localLogDungeonRun,
      ).pipe(E.mapError(mapLocalLogDungeonRunDAOError));

      const rows = yield* sql`
        INSERT INTO
          local_log_dungeon_run (dungeon_run_id, status, created_at, updated_at)
        VALUES
          (
            ${insert.dungeonRunId},
            ${insert.status},
            ${insert.createdAt},
            ${insert.updatedAt}
          )
        RETURNING
          dungeon_run_id,
          status,
          created_at,
          updated_at
      `;

      const localLogDungeonRuns = yield* decodeLocalLogDungeonRunRows(rows);

      const persistedLocalLogDungeonRun = localLogDungeonRuns[0];

      if (persistedLocalLogDungeonRun === undefined) {
        return yield* new LocalLogDungeonRunDAOError({
          reason: new DungeonRunNotReturnedAfterInsertError({ dungeonRunId }),
        });
      }

      return persistedLocalLogDungeonRun;
    }).pipe(E.mapError(mapLocalLogDungeonRunDAOError));
  };

  const finishRun = ({
    dungeonRunId,
    status,
  }: {
    readonly dungeonRunId: DungeonRunId;
    readonly status: Exclude<DungeonRunStatus, "ACTIVE">;
  }): E.Effect<void, LocalLogDungeonRunDAOError> => {
    return E.gen(function* () {
      const updatedAt = yield* DateTime.now;

      const encodedUpdatedAt = yield* Schema.encodeEffect(
        Schema.DateTimeUtcFromMillis,
      )(updatedAt).pipe(E.mapError(mapLocalLogDungeonRunDAOError));

      const rows = yield* sql`
        UPDATE local_log_dungeon_run
        SET
          status = ${status},
          updated_at = ${encodedUpdatedAt}
        WHERE
          dungeon_run_id = ${dungeonRunId}
          AND status = 'ACTIVE'
        RETURNING
          dungeon_run_id
      `;

      if (rows[0] === undefined) {
        return yield* makeRunNotFoundOrInactiveError(dungeonRunId);
      }
    }).pipe(E.mapError(mapLocalLogDungeonRunDAOError));
  };

  const complete: LocalLogDungeonRunDAOShape["complete"] = ({
    dungeonRunId,
  }) => {
    return finishRun({
      dungeonRunId,
      status: "COMPLETED",
    });
  };

  const exit: LocalLogDungeonRunDAOShape["exit"] = ({ dungeonRunId }) => {
    return finishRun({
      dungeonRunId,
      status: "EXITED",
    });
  };

  const listActive: LocalLogDungeonRunDAOShape["listActive"] = ({
    createdBefore,
  }) => {
    return E.gen(function* () {
      const encodedCreatedBefore = yield* Schema.encodeEffect(
        Schema.DateTimeUtcFromMillis,
      )(createdBefore);

      const rows = yield* sql`
        SELECT
          dungeon_run_id,
          status,
          created_at,
          updated_at
        FROM
          local_log_dungeon_run
        WHERE
          status = 'ACTIVE'
          AND created_at < ${encodedCreatedBefore}
      `;

      return yield* decodeLocalLogDungeonRunRows(rows);
    }).pipe(E.mapError(mapLocalLogDungeonRunDAOError));
  };

  const interrupt: LocalLogDungeonRunDAOShape["interrupt"] = ({
    dungeonRunId,
  }) => {
    return finishRun({
      dungeonRunId,
      status: "INTERRUPTED",
    });
  };

  return {
    complete,
    create,
    exit,
    getByDungeonRunId,
    interrupt,
    listActive,
  } satisfies LocalLogDungeonRunDAOShape;
});
