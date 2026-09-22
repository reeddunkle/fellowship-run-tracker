import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { type DungeonRunDAOShape } from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunDAOError } from "@frt/db/errors/dungeon-run-dao-error.ts";
import {
  DungeonRunNotFoundError,
  DungeonRunNotReturnedAfterInsertError,
} from "@frt/db/errors/dungeon-run-error.ts";
import { UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";
import { DungeonRunModel } from "@frt/db/models/dungeon-run-model.ts";
import { type DungeonRunId } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";

function mapDungeonRunDAOError(cause: unknown): DungeonRunDAOError {
  if (cause instanceof DungeonRunDAOError) {
    return cause;
  }

  return new DungeonRunDAOError({
    reason: new UnexpectedDatabaseError({ cause }),
  });
}

function decodeDungeonRunRows(
  rows: unknown,
): E.Effect<ReadonlyArray<DungeonRunModel>, DungeonRunDAOError> {
  return Schema.decodeUnknownEffect(Schema.Array(DungeonRunModel))(rows).pipe(
    E.mapError(mapDungeonRunDAOError),
  );
}

function makeRunNotFoundError(dungeonRunId: DungeonRunId): DungeonRunDAOError {
  return new DungeonRunDAOError({
    reason: new DungeonRunNotFoundError({ dungeonRunId }),
  });
}

export const makeDungeonRunDAO = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const getById: DungeonRunDAOShape["getById"] = ({ id }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          id,
          dungeon_id,
          dungeon_level,
          source,
          is_own_run,
          started_at,
          ended_at,
          created_at,
          updated_at
        FROM
          dungeon_run
        WHERE
          id = ${id}
        LIMIT
          1
      `;

      const dungeonRuns = yield* decodeDungeonRunRows(rows);
      const dungeonRun = dungeonRuns[0];

      return dungeonRun === undefined
        ? Option.none<DungeonRunModel>()
        : Option.some(dungeonRun);
    }).pipe(E.mapError(mapDungeonRunDAOError));
  };

  const create: DungeonRunDAOShape["create"] = ({
    dungeonId,
    dungeonLevel,
    endedAt,
    isOwnRun,
    source,
    startedAt,
  }) => {
    return E.gen(function* () {
      const dungeonRun = DungeonRunModel.insert.make({
        dungeonId,
        dungeonLevel,
        endedAt,
        isOwnRun,
        source,
        startedAt,
      });

      const insert = yield* Schema.encodeEffect(DungeonRunModel.insert)(
        dungeonRun,
      ).pipe(E.mapError(mapDungeonRunDAOError));

      const rows = yield* sql`
        INSERT INTO
          dungeon_run (
            id,
            dungeon_id,
            dungeon_level,
            source,
            is_own_run,
            started_at,
            ended_at,
            created_at,
            updated_at
          )
        VALUES
          (
            ${insert.id},
            ${insert.dungeonId},
            ${insert.dungeonLevel},
            ${insert.source},
            ${insert.isOwnRun},
            ${insert.startedAt},
            ${insert.endedAt},
            ${insert.createdAt},
            ${insert.updatedAt}
          )
        RETURNING
          id,
          dungeon_id,
          dungeon_level,
          source,
          is_own_run,
          started_at,
          ended_at,
          created_at,
          updated_at
      `;

      const dungeonRuns = yield* decodeDungeonRunRows(rows);
      const persistedDungeonRun = dungeonRuns[0];

      if (persistedDungeonRun === undefined) {
        return yield* new DungeonRunDAOError({
          reason: new DungeonRunNotReturnedAfterInsertError({
            dungeonRunId: dungeonRun.id,
          }),
        });
      }

      return persistedDungeonRun;
    }).pipe(E.mapError(mapDungeonRunDAOError));
  };

  const delete_: DungeonRunDAOShape["delete"] = ({ dungeonRunId }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        DELETE FROM dungeon_run
        WHERE
          id = ${dungeonRunId}
        RETURNING
          id
      `;

      if (rows[0] === undefined) {
        return yield* makeRunNotFoundError(dungeonRunId);
      }
    }).pipe(E.mapError(mapDungeonRunDAOError));
  };

  const deleteByDungeon: DungeonRunDAOShape["deleteByDungeon"] = ({
    dungeonId,
    dungeonLevel,
    isOwnRun,
  }) => {
    return sql`
      DELETE FROM dungeon_run
      WHERE
        dungeon_id = ${dungeonId}
        AND dungeon_level = ${dungeonLevel}
        AND is_own_run = ${isOwnRun ? 1 : 0}
    `.pipe(E.asVoid, E.mapError(mapDungeonRunDAOError));
  };

  const start: DungeonRunDAOShape["start"] = ({ dungeonRunId, startedAt }) => {
    return E.gen(function* () {
      const encodedStartedAt = yield* Schema.encodeEffect(
        Schema.DateTimeUtcFromMillis,
      )(startedAt).pipe(E.mapError(mapDungeonRunDAOError));

      const updatedAt = yield* DateTime.now;

      const encodedUpdatedAt = yield* Schema.encodeEffect(
        Schema.DateTimeUtcFromMillis,
      )(updatedAt).pipe(E.mapError(mapDungeonRunDAOError));

      const rows = yield* sql`
        UPDATE dungeon_run
        SET
          started_at = ${encodedStartedAt},
          updated_at = ${encodedUpdatedAt}
        WHERE
          id = ${dungeonRunId}
        RETURNING
          id
      `;

      if (rows[0] === undefined) {
        return yield* makeRunNotFoundError(dungeonRunId);
      }
    }).pipe(E.mapError(mapDungeonRunDAOError));
  };

  const end: DungeonRunDAOShape["end"] = ({ dungeonRunId, endedAt }) => {
    return E.gen(function* () {
      const encodedEndedAt = yield* Schema.encodeEffect(
        Schema.DateTimeUtcFromMillis,
      )(endedAt).pipe(E.mapError(mapDungeonRunDAOError));

      const updatedAt = yield* DateTime.now;

      const encodedUpdatedAt = yield* Schema.encodeEffect(
        Schema.DateTimeUtcFromMillis,
      )(updatedAt).pipe(E.mapError(mapDungeonRunDAOError));

      const rows = yield* sql`
        UPDATE dungeon_run
        SET
          ended_at = ${encodedEndedAt},
          updated_at = ${encodedUpdatedAt}
        WHERE
          id = ${dungeonRunId}
        RETURNING
          id
      `;

      if (rows[0] === undefined) {
        return yield* makeRunNotFoundError(dungeonRunId);
      }
    }).pipe(E.mapError(mapDungeonRunDAOError));
  };

  return {
    create,
    delete: delete_,
    deleteByDungeon,
    end,
    getById,
    start,
  } satisfies DungeonRunDAOShape;
});
