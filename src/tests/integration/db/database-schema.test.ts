import * as E from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { describe, expect, test } from "vitest";

import { makeDatabaseLayer } from "@/db/database-layer.ts";
import { runTest } from "@/tests/common/run-test.ts";

describe("Database schema", () => {
  test("cascades configuration deletion to milestones and milestone requirements", async () => {
    const program = E.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* sql`
        INSERT INTO
          dungeon (id, map_id, name, created_at, updated_at)
        VALUES
          ('11', '26', 'Everdawn Grove', 1000, 1000)
      `;

      yield* sql`
        INSERT INTO
          configuration_definition (
            id,
            dungeon_id,
            dungeon_level,
            fingerprint,
            canonical_json,
            created_at,
            updated_at
          )
        VALUES
          (
            'configuration-definition-1',
            '11',
            63,
            'definition-fingerprint-1',
            '{}',
            1000,
            1000
          )
      `;

      yield* sql`
        INSERT INTO
          configuration (
            id,
            configuration_definition_id,
            label,
            fingerprint,
            canonical_json,
            created_at,
            updated_at
          )
        VALUES
          (
            'configuration-1',
            'configuration-definition-1',
            'Test Configuration',
            'configuration-fingerprint-1',
            '{}',
            1000,
            1000
          )
      `;

      yield* sql`
        INSERT INTO
          requirement (
            id,
            configuration_definition_id,
            type,
            target_id,
            start_occurrence,
            required_count,
            created_at,
            updated_at
          )
        VALUES
          (
            'requirement-1',
            'configuration-definition-1',
            'UNIT_DEATH',
            '42',
            1,
            1,
            1000,
            1000
          )
      `;

      yield* sql`
        INSERT INTO
          milestone (
            id,
            configuration_id,
            label,
            created_at,
            updated_at
          )
        VALUES
          (
            'milestone-1',
            'configuration-1',
            'Desecrator 1 Killed',
            1000,
            1000
          )
      `;

      yield* sql`
        INSERT INTO
          milestone_requirement (milestone_id, requirement_id, created_at)
        VALUES
          ('milestone-1', 'requirement-1', 1000)
      `;

      yield* sql`
        DELETE FROM configuration
        WHERE
          id = 'configuration-1'
      `;

      const configurations = yield* sql`
        SELECT
          id
        FROM
          configuration
      `;

      const configurationDefinitions = yield* sql`
        SELECT
          id
        FROM
          configuration_definition
      `;

      const milestones = yield* sql`
        SELECT
          id
        FROM
          milestone
      `;

      const milestoneRequirements = yield* sql`
        SELECT
          milestone_id,
          requirement_id
        FROM
          milestone_requirement
      `;

      const requirements = yield* sql`
        SELECT
          id
        FROM
          requirement
      `;

      expect(configurations).toEqual([]);
      expect(milestones).toEqual([]);
      expect(milestoneRequirements).toEqual([]);

      expect(configurationDefinitions).toEqual([
        {
          id: "configuration-definition-1",
        },
      ]);

      expect(requirements).toEqual([
        {
          id: "requirement-1",
        },
      ]);
    }).pipe(E.provide(makeDatabaseLayer(":memory:")));

    await runTest(program);
  });
});
