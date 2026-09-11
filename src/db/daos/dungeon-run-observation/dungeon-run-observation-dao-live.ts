import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import {
  DungeonRunObservationDAO,
  type DungeonRunObservationDAOShape,
  type DungeonRunObservationHistory,
} from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { DungeonRunObservationModel } from "@/db/models/dungeon-run-observation-model.ts";
import { DungeonRunObservationDAOError } from "@/errors/dungeon-run-observation-dao-error.ts";
import { RequirementEventTypeSchema } from "@/services/fellowship/validation/requirement-event-type-schema.ts";
import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@/validation/common-schemas.ts";

const DungeonRunObservationHistorySchema = Schema.Struct({
  elapsedMilliseconds: Schema.Finite,
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
    details: {
      _tag: "Unexpected",
      cause,
    },
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

const make = E.gen(function* () {
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

  const getHistoryByConfigurationDefinitionId: DungeonRunObservationDAOShape["getHistoryByConfigurationDefinitionId"] =
    ({ configurationDefinitionId }) => {
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
                dungeon_run.configuration_definition_id = ${configurationDefinitionId}
                AND dungeon_run.started_at IS NOT NULL
            )
          SELECT
            type,
            target_id,
            occurrence,
            observed_at - started_at AS elapsed_milliseconds
          FROM
            observations
          ORDER BY
            type,
            target_id,
            occurrence,
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
          AND status = 'ACTIVE'
        RETURNING
          id
      `;

      if (rows[0] !== undefined) {
        return;
      }

      return yield* new DungeonRunObservationDAOError({
        details: {
          _tag: "RunNotFoundOrInactive",
          dungeonRunId,
        },
      });
    }).pipe(E.mapError(mapDungeonRunObservationDAOError));
  };

  return {
    getByDungeonRunId,
    getHistoryByConfigurationDefinitionId,
    observe,
  } satisfies DungeonRunObservationDAOShape;
});

export const DungeonRunObservationDAOLive = Layer.effect(
  DungeonRunObservationDAO,
  make,
);
