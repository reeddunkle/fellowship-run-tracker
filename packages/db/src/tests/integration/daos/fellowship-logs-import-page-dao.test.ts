import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { FellowshipLogsImportPageDAO } from "@frt/db/daos/fellowship-logs-import-page/fellowship-logs-import-page-dao.ts";
import { makeDatabasePersistenceTestLayer } from "@frt/db/tests/common/layers/database-persistence-test-layer.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";
import { type BackgroundJobId } from "@frt/shared/validation/background-job/background-job-id-schema.ts";

const insertJob = E.gen(function* () {
  const backgroundJobDAO = yield* BackgroundJobDAO;

  const { job } = yield* backgroundJobDAO.insert({
    idempotencyKey: null,
    kind: "TestJob",
    payload: { value: 1 },
    queue: "test-queue",
  });

  return job;
});

function insertPage(
  backgroundJobId: BackgroundJobId,
  pageIndex: number,
  nextPageTimestamp: number | null = (pageIndex + 1) * 1000,
) {
  return FellowshipLogsImportPageDAO.use((dao) => {
    return dao.insert({
      backgroundJobId,
      nextPageTimestamp,
      page: JSON.stringify({ index: pageIndex }),
      pageIndex,
      progress: nextPageTimestamp === null ? 1 : 0.5,
      reportRevision: 3,
    });
  });
}

function listPages(backgroundJobId: BackgroundJobId) {
  return FellowshipLogsImportPageDAO.use((dao) => {
    return dao.list({ backgroundJobId });
  });
}

describe("FellowshipLogsImportPageDAO", () => {
  test("lists a job's pages in the order they were fetched", async () => {
    const program = E.gen(function* () {
      const job = yield* insertJob;
      const otherJob = yield* insertJob;

      yield* insertPage(job.id, 1, null);
      yield* insertPage(job.id, 0);
      yield* insertPage(otherJob.id, 0);

      const pages = yield* listPages(job.id);

      expect(
        pages.map((page) => {
          return page.pageIndex;
        }),
      ).toEqual([0, 1]);
      expect(pages[0]).toMatchObject({
        backgroundJobId: job.id,
        nextPageTimestamp: 1000,
        page: '{"index":0}',
        progress: 0.5,
        reportRevision: 3,
      });
      expect(pages[1]?.nextPageTimestamp).toBeNull();
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("keeps the first copy when a page is saved twice", async () => {
    const program = E.gen(function* () {
      const job = yield* insertJob;

      yield* insertPage(job.id, 0);
      yield* insertPage(job.id, 0, 5000);

      const pages = yield* listPages(job.id);

      expect(pages).toHaveLength(1);
      expect(pages[0]?.nextPageTimestamp).toBe(1000);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("deletes a job's pages", async () => {
    const program = E.gen(function* () {
      const job = yield* insertJob;
      const otherJob = yield* insertJob;

      yield* insertPage(job.id, 0);
      yield* insertPage(otherJob.id, 0);

      yield* FellowshipLogsImportPageDAO.use((dao) => {
        return dao.deleteForJob({ backgroundJobId: job.id });
      });

      expect(yield* listPages(job.id)).toEqual([]);
      expect(yield* listPages(otherJob.id)).toHaveLength(1);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("deletes a job's pages along with the job", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;
      const job = yield* insertJob;

      yield* insertPage(job.id, 0);
      yield* backgroundJobDAO.delete({ id: job.id, statuses: ["QUEUED"] });

      expect(yield* listPages(job.id)).toEqual([]);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });
});
