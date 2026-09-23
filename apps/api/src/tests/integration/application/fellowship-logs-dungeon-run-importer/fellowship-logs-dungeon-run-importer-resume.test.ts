import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { describe, expect, test } from "vitest";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { FellowshipLogs } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import {
  type FellowshipLogsFetchControl,
  makeControlledFellowshipLogsFixtureLayer,
  makeFellowshipLogsFetchControl,
} from "@frt/api/tests/common/layers/controlled-fellowship-logs-fixture-layer.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { FellowshipLogsImportPageDAO } from "@frt/db/daos/fellowship-logs-import-page/fellowship-logs-import-page-dao.ts";
import { type BackgroundJobId } from "@frt/shared/validation/background-job/background-job-id-schema.ts";
import { type DungeonRunId } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

const REPORT_CODE = Schema.decodeSync(FellowshipLogsReportCodeSchema)(
  "XdfFZzgHBJNr6m3v",
);

const FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(15);

// The recorded fight has 13 pages.
const FIXTURE_PAGE_COUNT = 13;

function makeTestLayer(control: FellowshipLogsFetchControl) {
  return FellowshipLogsDungeonRunImporter.layerNoDeps.pipe(
    Layer.provideMerge(
      Layer.merge(
        makePersistenceTestLayer(":memory:"),
        makeControlledFellowshipLogsFixtureLayer(control),
      ),
    ),
  );
}

const insertImportJob = BackgroundJobDAO.use((dao) => {
  return dao.insert({
    idempotencyKey: null,
    kind: "ImportFellowshipLogsDungeonRun",
    payload: {},
    queue: "fellowship-logs-import",
  });
}).pipe(
  E.map(({ job }) => {
    return job.id;
  }),
);

function importReport(backgroundJobId?: BackgroundJobId) {
  return FellowshipLogsDungeonRunImporter.use((importer) => {
    return importer.importReport({
      fightId: FIGHT_ID,
      isOwnRun: true,
      reportCode: REPORT_CODE,
      ...(backgroundJobId === undefined ? {} : { backgroundJobId }),
    });
  });
}

function listSavedPages(backgroundJobId: BackgroundJobId) {
  return FellowshipLogsImportPageDAO.use((dao) => {
    return dao.list({ backgroundJobId });
  });
}

const countAllSavedPages = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* sql<{ readonly count: number }>`
    SELECT
      COUNT(*) AS count
    FROM
      fellowship_logs_import_page
  `;

  return rows[0]?.count ?? 0;
});

/** What an import produced, minus generated ids and timestamps. */
function getImportedRun(dungeonRunId: DungeonRunId) {
  return E.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

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

describe("FellowshipLogsDungeonRunImporter resuming", () => {
  test("carries on from the last saved page instead of fetching every page again", async () => {
    const straightThroughControl = makeFellowshipLogsFetchControl();

    const straightThrough = await E.gen(function* () {
      const { dungeonRunId } = yield* importReport();

      return yield* getImportedRun(dungeonRunId);
    }).pipe(E.provide(makeTestLayer(straightThroughControl)), runTest);

    const control = makeFellowshipLogsFetchControl();

    const {
      firstAttemptError,
      pagesAfterFirstAttempt,
      pagesAfterSuccess,
      resumed,
    } = await E.gen(function* () {
      const backgroundJobId = yield* insertImportJob;

      control.failAfterPages = 5;

      const error = yield* importReport(backgroundJobId).pipe(E.flip);
      const savedAfterFirstAttempt = yield* listSavedPages(backgroundJobId);

      control.failAfterPages = undefined;

      const { dungeonRunId } = yield* importReport(backgroundJobId);

      return {
        firstAttemptError: error,
        pagesAfterFirstAttempt: savedAfterFirstAttempt,
        pagesAfterSuccess: yield* listSavedPages(backgroundJobId),
        resumed: yield* getImportedRun(dungeonRunId),
      };
    }).pipe(E.provide(makeTestLayer(control)), runTest);

    expect(firstAttemptError._tag).toBe("FellowshipLogsRateLimitExceededError");
    expect(pagesAfterFirstAttempt).toHaveLength(5);

    // Every page was fetched exactly once across both attempts, and the second
    // started where the first left off.
    expect(control.pagesFetched).toBe(FIXTURE_PAGE_COUNT);
    expect(control.startTimes).toEqual([
      undefined,
      pagesAfterFirstAttempt.at(-1)?.nextPageTimestamp,
    ]);

    expect(resumed).toEqual(straightThrough);
    expect(resumed.observations.length).toBeGreaterThan(0);
    expect(pagesAfterSuccess).toEqual([]);
  });

  test("replays saved pages without fetching when every page was saved", async () => {
    const control = makeFellowshipLogsFetchControl();

    const imported = await E.gen(function* () {
      const backgroundJobId = yield* insertImportJob;
      const importPageDAO = yield* FellowshipLogsImportPageDAO;

      // Save every page, then fail before the run is written, as if the app
      // closed right after the last page arrived.
      const pages = yield* FellowshipLogs.use((fellowshipLogs) => {
        return Stream.runCollect(
          fellowshipLogs.streamReportPages({
            fightId: FIGHT_ID,
            reportCode: REPORT_CODE,
          }),
        );
      });

      yield* E.forEach(pages, (page, pageIndex) => {
        return importPageDAO.insert({
          backgroundJobId,
          nextPageTimestamp: page.events.nextPageTimestamp,
          page: JSON.stringify(page),
          pageIndex,
          progress: (pageIndex + 1) / pages.length,
          reportRevision: page.revision,
        });
      });

      control.pagesFetched = 0;
      control.startTimes = [];

      return yield* importReport(backgroundJobId);
    }).pipe(E.provide(makeTestLayer(control)), runTest);

    expect(imported.dungeonRunId).toEqual(expect.any(String));
    expect(control.pagesFetched).toBe(0);
    expect(control.startTimes).toEqual([]);
  });

  test("starts over when the report changed since its pages were saved", async () => {
    const control = makeFellowshipLogsFetchControl();

    const { error, savedPages } = await E.gen(function* () {
      const backgroundJobId = yield* insertImportJob;

      control.failAfterPages = 2;
      yield* importReport(backgroundJobId).pipe(E.flip);

      control.failAfterPages = undefined;
      control.overrideRevision = 999;

      return {
        error: yield* importReport(backgroundJobId).pipe(E.flip),
        savedPages: yield* listSavedPages(backgroundJobId),
      };
    }).pipe(E.provide(makeTestLayer(control)), runTest);

    expect(error._tag).toBe("FellowshipLogsDungeonRunImportReportChangedError");
    expect(savedPages).toEqual([]);
  });

  test("saves nothing when the import isn't run by a job", async () => {
    const control = makeFellowshipLogsFetchControl();

    const savedPageCount = await E.gen(function* () {
      yield* importReport();

      return yield* countAllSavedPages;
    }).pipe(E.provide(makeTestLayer(control)), runTest);

    expect(savedPageCount).toBe(0);
    expect(control.pagesFetched).toBe(FIXTURE_PAGE_COUNT);
  });
});
