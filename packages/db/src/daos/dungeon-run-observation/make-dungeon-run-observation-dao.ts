import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import {
  type DungeonRunObservationDAOShape,
  type DungeonRunObservationHistory,
} from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { DungeonRunNotFoundError } from "@frt/db/errors/dungeon-run-error.ts";
import { DungeonRunObservationDAOError } from "@frt/db/errors/dungeon-run-observation-dao-error.ts";
import { UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";
import { DungeonRunObservationModel } from "@frt/db/models/dungeon-run-observation-model.ts";
import { RequirementEventTypeSchema } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";
import {
  BooleanIntSchema,
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@frt/shared/validation/common-schemas.ts";
import { DungeonRunIdSchema } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";

const DungeonRunObservationHistorySchema = Schema.Struct({
  dungeonRunId: DungeonRunIdSchema,
  elapsedMilliseconds: Schema.Finite,
  isOwnRun: BooleanIntSchema,
  occurrence: PositiveIntegerSchema,
  targetId: NonEmptyStringSchema,
  type: RequirementEventTypeSchema,
});

function mapDungeonRunObservationDAOError(
  cause: unknown,
): DungeonRunObservationDAOError {
  if (cause instanceof DungeonRunObservationDAOError) {
    return cause;
  }

  return new DungeonRunObservationDAOError({
    reason: new UnexpectedDatabaseError({ cause }),
  });
}

function decodeDungeonRunObservationRows(
  rows: unknown,
): E.Effect<
  ReadonlyArray<DungeonRunObservationModel>,
  DungeonRunObservationDAOError
> {
  return Schema.decodeUnknownEffect(Schema.Array(DungeonRunObservationModel))(
    rows,
  ).pipe(E.mapError(mapDungeonRunObservationDAOError));
}

function decodeDungeonRunObservationHistoryRows(
  rows: unknown,
): E.Effect<
  ReadonlyArray<DungeonRunObservationHistory>,
  DungeonRunObservationDAOError
> {
  return Schema.decodeUnknownEffect(
    Schema.Array(DungeonRunObservationHistorySchema),
  )(rows).pipe(E.mapError(mapDungeonRunObservationDAOError));
}

export const makeDungeonRunObservationDAO = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const getByDungeonRunId: DungeonRunObservationDAOShape["getByDungeonRunId"] =
    ({ dungeonRunId }) => {
      return E.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            dungeon_run_id,
            type,
            target_id,
            observed_at,
            created_at
          FROM
            dungeon_run_observation
          WHERE
            dungeon_run_id = ${dungeonRunId}
          ORDER BY
            observed_at,
            id
        `;

        return yield* decodeDungeonRunObservationRows(rows);
      }).pipe(E.mapError(mapDungeonRunObservationDAOError));
    };

  const getHistoryByDungeon: DungeonRunObservationDAOShape["getHistoryByDungeon"] =
    ({ dungeonId, dungeonLevel }) => {
      return E.gen(function* () {
        const rows = yield* sql`
          WITH
            observations AS (
              SELECT
                dungeon_run_observation.id,
                dungeon_run_observation.dungeon_run_id,
                dungeon_run_observation.type,
                dungeon_run_observation.target_id,
                dungeon_run_observation.observed_at,
                dungeon_run.started_at,
                dungeon_run.is_own_run,
                ROW_NUMBER() OVER (
                  PARTITION BY
                    dungeon_run_observation.dungeon_run_id,
                    dungeon_run_observation.type,
                    dungeon_run_observation.target_id
                  ORDER BY
                    dungeon_run_observation.observed_at,
                    dungeon_run_observation.id
                ) AS occurrence
              FROM
                dungeon_run_observation
                INNER JOIN dungeon_run ON dungeon_run.id = dungeon_run_observation.dungeon_run_id
              WHERE
                dungeon_run.dungeon_id = ${dungeonId}
                AND dungeon_run.dungeon_level = ${dungeonLevel}
                AND dungeon_run.started_at IS NOT NULL
            )
          SELECT
            dungeon_run_id,
            type,
            target_id,
            occurrence,
            is_own_run,
            observed_at - started_at AS elapsed_milliseconds
          FROM
            observations
          ORDER BY
            type,
            target_id,
            occurrence,
            is_own_run,
            elapsed_milliseconds
        `;

        return yield* decodeDungeonRunObservationHistoryRows(rows);
      }).pipe(E.mapError(mapDungeonRunObservationDAOError));
    };

  const observe: DungeonRunObservationDAOShape["observe"] = ({
    dungeonRunId,
    observedAt,
    targetId,
    type,
  }) => {
    return E.gen(function* () {
      const observation = DungeonRunObservationModel.insert.make({
        dungeonRunId,
        observedAt,
        targetId,
        type,
      });

      const insert = yield* Schema.encodeEffect(
        DungeonRunObservationModel.insert,
      )(observation).pipe(E.mapError(mapDungeonRunObservationDAOError));

      const rows = yield* sql`
        INSERT INTO
          dungeon_run_observation (
            id,
            dungeon_run_id,
            type,
            target_id,
            observed_at,
            created_at
          )
        SELECT
          ${insert.id},
          ${insert.dungeonRunId},
          ${insert.type},
          ${insert.targetId},
          ${insert.observedAt},
          ${insert.createdAt}
        FROM
          dungeon_run
        WHERE
          id = ${insert.dungeonRunId}
        RETURNING
          id
      `;

      if (rows[0] !== undefined) {
        return;
      }

      return yield* new DungeonRunObservationDAOError({
        reason: new DungeonRunNotFoundError({ dungeonRunId }),
      });
    }).pipe(E.mapError(mapDungeonRunObservationDAOError));
  };

  return {
    getByDungeonRunId,
    getHistoryByDungeon,
    observe,
  } satisfies DungeonRunObservationDAOShape;
});
