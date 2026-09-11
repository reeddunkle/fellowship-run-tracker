import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import {
  DungeonRunDAO,
  type DungeonRunDAOShape,
} from "@/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunModel } from "@/db/models/dungeon-run-model.ts";
import { DungeonRunDAOError } from "@/errors/dungeon-run-dao-error.ts";
import { type DungeonRunId } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";

function mapDungeonRunDAOError(cause: unknown): DungeonRunDAOError {
  if (cause instanceof DungeonRunDAOError) {
    return cause;
  }

  return new DungeonRunDAOError({
    details: {
      _tag: "Unexpected",
      cause,
    },
  });
}

function decodeDungeonRunRows(
  rows: unknown,
): E.Effect<ReadonlyArray<DungeonRunModel>, DungeonRunDAOError> {
  return Schema.decodeUnknownEffect(Schema.Array(DungeonRunModel))(rows).pipe(
    E.mapError(mapDungeonRunDAOError),
  );
}

function makeRunNotFoundOrInactiveError(
  dungeonRunId: DungeonRunId,
): DungeonRunDAOError {
  return new DungeonRunDAOError({
    details: {
      _tag: "RunNotFoundOrInactive",
      dungeonRunId,
    },
  });
}

const make = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const getById: DungeonRunDAOShape["getById"] = ({ id }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          id,
          configuration_definition_id,
          dungeon_id,
          dungeon_level,
          status,
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
    configurationDefinitionId,
    dungeonId,
    dungeonLevel,
  }) => {
    return E.gen(function* () {
      const dungeonRun = DungeonRunModel.insert.make({
        configurationDefinitionId,
        dungeonId,
        dungeonLevel,
        endedAt: null,
        startedAt: null,
        status: "ACTIVE",
      });

      const insert = yield* Schema.encodeEffect(DungeonRunModel.insert)(
        dungeonRun,
      ).pipe(E.mapError(mapDungeonRunDAOError));

      const rows = yield* sql`
        INSERT INTO
          dungeon_run (
            id,
            configuration_definition_id,
            dungeon_id,
            dungeon_level,
            status,
            started_at,
            ended_at,
            created_at,
            updated_at
          )
        VALUES
          (
            ${insert.id},
            ${insert.configurationDefinitionId},
            ${insert.dungeonId},
            ${insert.dungeonLevel},
            ${insert.status},
            ${insert.startedAt},
            ${insert.endedAt},
            ${insert.createdAt},
            ${insert.updatedAt}
          )
        RETURNING
          id,
          configuration_definition_id,
          dungeon_id,
          dungeon_level,
          status,
          started_at,
          ended_at,
          created_at,
          updated_at
      `;

      const dungeonRuns = yield* decodeDungeonRunRows(rows);
      const persistedDungeonRun = dungeonRuns[0];

      if (persistedDungeonRun === undefined) {
        return yield* new DungeonRunDAOError({
          details: {
            _tag: "RunNotReturnedAfterInsert",
            dungeonRunId: dungeonRun.id,
          },
        });
      }

      return persistedDungeonRun;
    }).pipe(E.mapError(mapDungeonRunDAOError));
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
          AND status = 'ACTIVE'
        RETURNING
          id
      `;

      if (rows[0] === undefined) {
        return yield* makeRunNotFoundOrInactiveError(dungeonRunId);
      }
    }).pipe(E.mapError(mapDungeonRunDAOError));
  };

  const finishRun = ({
    dungeonRunId,
    endedAt,
    status,
  }: {
    readonly dungeonRunId: DungeonRunId;
    readonly endedAt: NonNullable<DungeonRunModel["endedAt"]>;
    readonly status: "COMPLETED" | "EXITED" | "INTERRUPTED";
  }): E.Effect<void, DungeonRunDAOError> => {
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
          status = ${status},
          ended_at = ${encodedEndedAt},
          updated_at = ${encodedUpdatedAt}
        WHERE
          id = ${dungeonRunId}
          AND status = 'ACTIVE'
        RETURNING
          id
      `;

      if (rows[0] === undefined) {
        return yield* makeRunNotFoundOrInactiveError(dungeonRunId);
      }
    }).pipe(E.mapError(mapDungeonRunDAOError));
  };

  const complete: DungeonRunDAOShape["complete"] = ({
    dungeonRunId,
    endedAt,
  }) => {
    return finishRun({
      dungeonRunId,
      endedAt,
      status: "COMPLETED",
    });
  };

  const exit: DungeonRunDAOShape["exit"] = ({ dungeonRunId, endedAt }) => {
    return finishRun({
      dungeonRunId,
      endedAt,
      status: "EXITED",
    });
  };

  const interrupt: DungeonRunDAOShape["interrupt"] = ({
    dungeonRunId,
    endedAt,
  }) => {
    return finishRun({
      dungeonRunId,
      endedAt,
      status: "INTERRUPTED",
    });
  };

  return {
    complete,
    create,
    exit,
    getById,
    interrupt,
    start,
  } satisfies DungeonRunDAOShape;
});

export const DungeonRunDAOLive = Layer.effect(DungeonRunDAO, make);
