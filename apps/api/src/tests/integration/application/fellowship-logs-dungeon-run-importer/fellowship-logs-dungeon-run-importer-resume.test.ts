import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { FellowshipLogs } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import {
  type FellowshipLogsFetchControl,
  makeControlledFellowshipLogsFixtureLayer,
  makeFellowshipLogsFetchControl,
  RECORDED_FIGHT,
  RECORDED_FIGHT_PAGE_COUNT,
} from "@frt/api/tests/common/layers/controlled-fellowship-logs-fixture-layer.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsCacheDatabase } from "@frt/db/databases/fellowship-logs-cache-database.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import { type DungeonRunId } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";

function makeTestLayer(control: FellowshipLogsFetchControl) {
  const PersistenceTestLive = makePersistenceTestLayer();

  const FellowshipLogsTestLive = makeControlledFellowshipLogsFixtureLayer(
    control,
  ).pipe(Layer.provide(PersistenceTestLive));

  return FellowshipLogsDungeonRunImporter.layerNoDeps.pipe(
    Layer.provideMerge(
      Layer.merge(PersistenceTestLive, FellowshipLogsTestLive),
    ),
  );
}

const importReport = FellowshipLogsDungeonRunImporter.use((importer) => {
  return importer.importReport({ ...RECORDED_FIGHT, isOwnRun: true });
});

/** Deletes an imported run, so the fight can be imported again. */
function deleteRun(dungeonRunId: DungeonRunId) {
  return E.gen(function* () {
    const sql = yield* MainDatabase;

    yield* sql`
      DELETE FROM dungeon_run
      WHERE
        id = ${dungeonRunId}
    `;
  });
}

const countCachedResponses = E.gen(function* () {
  const sql = yield* FellowshipLogsCacheDatabase;

  const rows = yield* sql<{
    readonly count: number;
    readonly operation: string;
  }>`
    SELECT
      operation,
      COUNT(*) AS count
    FROM
      fellowship_logs_response
    GROUP BY
      operation
    ORDER BY
      operation
  `;

  return Object.fromEntries(
    rows.map((row) => {
      return [row.operation, row.count];
    }),
  );
});

/** What an import produced, minus generated ids and timestamps. */
function getImportedRun(dungeonRunId: DungeonRunId) {
  return E.gen(function* () {
    const sql = yield* MainDatabase;

    const runs = yield* sql`
      SELECT
        dungeon_id,
        dungeon_level,
        started_at,
        ended_at
      FROM
        dungeon_run
      WHERE
        id = ${dungeonRunId}
    `;

    const observations = yield* sql`
      SELECT
        type,
        target_id,
        observed_at
      FROM
        dungeon_run_observation
      WHERE
        dungeon_run_id = ${dungeonRunId}
      ORDER BY
        observed_at,
        type,
        target_id
    `;

    return { observations, run: runs[0] };
  });
}

describe("FellowshipLogsDungeonRunImporter with the Fellowship Logs cache", () => {
  test("carries on from the cached pages instead of fetching them again", async () => {
    const straightThrough = await E.gen(function* () {
      const { dungeonRunId } = yield* importReport;

      return yield* getImportedRun(dungeonRunId);
    }).pipe(
      E.provide(makeTestLayer(makeFellowshipLogsFetchControl())),
      runTest,
    );

    const control = makeFellowshipLogsFetchControl();

    const { firstAttemptError, resumed } = await E.gen(function* () {
      control.failAfterPages = 5;

      const error = yield* importReport.pipe(E.flip);

      control.failAfterPages = undefined;

      const { dungeonRunId } = yield* importReport;

      return {
        firstAttemptError: error,
        resumed: yield* getImportedRun(dungeonRunId),
      };
    }).pipe(E.provide(makeTestLayer(control)), runTest);

    expect(firstAttemptError._tag).toBe("FellowshipLogsRateLimitExceededError");

    // Every page was fetched exactly once across both attempts.
    expect(control.pagesFetched).toBe(RECORDED_FIGHT_PAGE_COUNT);

    expect(resumed).toEqual(straightThrough);
    expect(resumed.observations.length).toBeGreaterThan(0);
  });

  test("imports a finished fight again without sending any requests", async () => {
    const control = makeFellowshipLogsFetchControl();

    const { cached, requestsForSecondImport } = await E.gen(function* () {
      const { dungeonRunId } = yield* importReport;

      yield* deleteRun(dungeonRunId);

      control.requests = [];

      yield* importReport;

      return {
        cached: yield* countCachedResponses,
        requestsForSecondImport: control.requests,
      };
    }).pipe(E.provide(makeTestLayer(control)), runTest);

    expect(requestsForSecondImport).toEqual([]);
    expect(cached).toEqual({
      FIGHT: 1,
      REPORT_PAGE: RECORDED_FIGHT_PAGE_COUNT,
    });
  });

  test("fetches a fight still in progress live, and caches none of its pages", async () => {
    const control = makeFellowshipLogsFetchControl();

    control.isInProgress = true;

    const cached = await E.gen(function* () {
      const { dungeonRunId } = yield* importReport;

      yield* deleteRun(dungeonRunId);
      yield* importReport;

      return yield* countCachedResponses;
    }).pipe(E.provide(makeTestLayer(control)), runTest);

    expect(control.pagesFetched).toBe(RECORDED_FIGHT_PAGE_COUNT * 2);

    // The fight itself is kept briefly, but none of its pages.
    expect(cached).toEqual({ FIGHT: 1 });
  });

  test("fails when an in-progress fight's report changes partway through", async () => {
    const control = makeFellowshipLogsFetchControl();

    control.isInProgress = true;

    const error = await FellowshipLogs.use((fellowshipLogs) => {
      return Stream.runDrain(
        fellowshipLogs.streamReportPages({
          ...RECORDED_FIGHT,
          // A live log uploads more of the report after the first page.
          onProgress: () => {
            return E.sync(() => {
              control.overrideRevision = 999;
            });
          },
        }),
      );
    }).pipe(E.flip, E.provide(makeTestLayer(control)), runTest);

    expect(error._tag).toBe("FellowshipLogsReportChangedError");
  });

  test("keeps using a finished fight's cached pages after its report's revision moves on", async () => {
    const control = makeFellowshipLogsFetchControl();

    const imported = await E.gen(function* () {
      const { dungeonRunId } = yield* importReport;

      yield* deleteRun(dungeonRunId);

      // Fresh pages would now report a newer revision, as they do once a
      // live log uploads another fight.
      control.overrideRevision = 999;

      return yield* importReport;
    }).pipe(E.provide(makeTestLayer(control)), runTest);

    expect(imported.dungeonRunId).toEqual(expect.any(String));
    expect(control.pagesFetched).toBe(RECORDED_FIGHT_PAGE_COUNT);
  });
});
