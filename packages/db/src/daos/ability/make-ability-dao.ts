import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { MainDatabase } from "@frt/db/databases/main-database.ts";
import { AbilityModel } from "@frt/db/models/ability-model.ts";

import { type AbilityDAOShape } from "./ability-dao.ts";

function decodeAbilityRows(
  rows: unknown,
): E.Effect<ReadonlyArray<AbilityModel>, Schema.SchemaError> {
  return Schema.decodeUnknownEffect(Schema.Array(AbilityModel))(rows);
}

export const makeAbilityDAO = E.gen(function* () {
  const sql = yield* MainDatabase;

  const getAll: AbilityDAOShape["getAll"] = () => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          ability.created_at AS createdAt,
          ability.id,
          ability.name,
          ability.updated_at AS updatedAt,
          ability_unit.unit_id AS unitId
        FROM
          ability
          LEFT JOIN ability_unit ON ability_unit.ability_id = ability.id
        ORDER BY
          ability.name
      `;

      return yield* decodeAbilityRows(rows);
    });
  };

  const getById: AbilityDAOShape["getById"] = ({ id }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          ability.created_at AS createdAt,
          ability.id,
          ability.name,
          ability.updated_at AS updatedAt,
          ability_unit.unit_id AS unitId
        FROM
          ability
          LEFT JOIN ability_unit ON ability_unit.ability_id = ability.id
        WHERE
          ability.id = ${id}
        LIMIT
          1
      `;

      const abilities = yield* decodeAbilityRows(rows);
      const ability = abilities[0];

      return ability === undefined
        ? Option.none<AbilityModel>()
        : Option.some(ability);
    });
  };

  return {
    getAll,
    getById,
  } satisfies AbilityDAOShape;
});
