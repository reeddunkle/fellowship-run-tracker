import * as NodeServices from "@effect/platform-node/NodeServices";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipLogsLookupWorkflowDAO } from "@frt/db/daos/fellowship-logs-lookup-workflow/fellowship-logs-lookup-workflow-dao.ts";
import { makeAnalyticsDatabaseLayer } from "@frt/db/databases/analytics-database.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";
import { FellowshipLogsConnectionGenerationSchema } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsLookupWorkflowIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-lookup-workflow-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

const CONNECTION_GENERATION = Schema.decodeSync(
  FellowshipLogsConnectionGenerationSchema,
)("00000000-0000-4000-8000-000000000001");
const OTHER_CONNECTION_GENERATION = Schema.decodeSync(
  FellowshipLogsConnectionGenerationSchema,
)("00000000-0000-4000-8000-000000000002");
const REPORT_CODE = Schema.decodeSync(FellowshipLogsReportCodeSchema)(
  "XdfFZzgHBJNr6m3v",
);
const FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(15);
const WORKFLOW_ID = Schema.decodeSync(FellowshipLogsLookupWorkflowIdSchema)(
  "00000000-0000-4000-8000-000000000003",
);
const OTHER_WORKFLOW_ID = Schema.decodeSync(
  FellowshipLogsLookupWorkflowIdSchema,
)("00000000-0000-4000-8000-000000000004");
const JOB_ID = Schema.decodeSync(BackgroundJobIdSchema)(
  "00000000-0000-7000-8000-000000000001",
);
const OTHER_JOB_ID = Schema.decodeSync(BackgroundJobIdSchema)(
  "00000000-0000-7000-8000-000000000002",
);
const CREATED_AT = DateTime.makeUnsafe("2026-10-25T12:00:00Z");
const EXPIRES_AT = DateTime.makeUnsafe("2026-10-25T12:30:00Z");
const CLAIMED_AT = DateTime.makeUnsafe("2026-10-25T12:05:00Z");
const RETENTION_BEFORE = DateTime.makeUnsafe("2026-10-18T12:05:00Z");

const COST = {
  apiRequestCount: 1,
  applicationPoints: 0,
  cacheHitCount: 0,
  estimatedPoints: 0,
  totalPoints: 4,
  unmeasuredRequestCount: 0,
  userPoints: 4,
};

function makeLayer(filename = ":memory:") {
  return FellowshipLogsLookupWorkflowDAO.layer.pipe(
    Layer.provideMerge(makeAnalyticsDatabaseLayer(filename)),
  );
}

function insertWorkflow(
  workflowId = WORKFLOW_ID,
  cost = COST,
  expiresAt = EXPIRES_AT,
) {
  return FellowshipLogsLookupWorkflowDAO.use((dao) => {
    return dao.insert({
      ...cost,
      connectionGeneration: CONNECTION_GENERATION,
      createdAt: CREATED_AT,
      expiresAt,
      fightId: FIGHT_ID,
      reportCode: REPORT_CODE,
      workflowId,
    });
  });
}

function claimWorkflow({
  connectionGeneration = CONNECTION_GENERATION,
  jobId = JOB_ID,
  workflowId = WORKFLOW_ID,
} = {}) {
  return FellowshipLogsLookupWorkflowDAO.use((dao) => {
    return dao.claim({
      claimedAt: CLAIMED_AT,
      claimedRetentionBefore: RETENTION_BEFORE,
      connectionGeneration,
      fightId: FIGHT_ID,
      jobId,
      reportCode: REPORT_CODE,
      workflowId,
    });
  });
}

describe("FellowshipLogsLookupWorkflowDAO", () => {
  test("keeps concurrent lookup costs for the same fight independent", async () => {
    const secondCost = { ...COST, totalPoints: 7, userPoints: 7 };
    const result = await E.gen(function* () {
      yield* E.all(
        [insertWorkflow(), insertWorkflow(OTHER_WORKFLOW_ID, secondCost)],
        { discard: true },
      );

      return yield* E.all(
        [
          claimWorkflow(),
          claimWorkflow({
            jobId: OTHER_JOB_ID,
            workflowId: OTHER_WORKFLOW_ID,
          }),
        ],
        { concurrency: "unbounded" },
      );
    }).pipe(E.provide(makeLayer()), runTest);

    expect(result).toEqual([
      { cost: COST, status: "CLAIMED" },
      { cost: secondCost, status: "CLAIMED" },
    ]);
  });

  test("survives a database restart between lookup and import", async () => {
    const result = await E.scoped(
      E.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "fellowship-run-tracker-lookup-workflow-",
        });
        const filename = path.join(directory, "analytics.db");

        yield* insertWorkflow().pipe(E.provide(makeLayer(filename)));

        return yield* claimWorkflow().pipe(E.provide(makeLayer(filename)));
      }),
    ).pipe(E.provide(NodeServices.layer), runTest);

    expect(result).toEqual({ cost: COST, status: "CLAIMED" });
  });

  test("rejects expired and mismatched workflows without blocking later claims", async () => {
    const expiredAt = DateTime.makeUnsafe("2026-10-25T12:04:00Z");
    const result = await E.gen(function* () {
      yield* insertWorkflow(WORKFLOW_ID, COST, expiredAt);
      const expired = yield* claimWorkflow();
      yield* insertWorkflow();
      const mismatched = yield* claimWorkflow({
        connectionGeneration: OTHER_CONNECTION_GENERATION,
      });
      const claimed = yield* claimWorkflow();
      const alreadyClaimed = yield* claimWorkflow({ jobId: OTHER_JOB_ID });

      return { alreadyClaimed, claimed, expired, mismatched };
    }).pipe(E.provide(makeLayer()), runTest);

    expect(result.expired).toEqual({
      reason: "EXPIRED",
      status: "UNAVAILABLE",
    });
    expect(result.mismatched).toEqual({
      reason: "MISMATCHED",
      status: "UNAVAILABLE",
    });
    expect(result.claimed).toEqual({ cost: COST, status: "CLAIMED" });
    expect(result.alreadyClaimed).toEqual({
      reason: "ALREADY_CLAIMED",
      status: "UNAVAILABLE",
    });
  });

  test("prunes expired and consumed workflows", async () => {
    const result = await E.gen(function* () {
      yield* insertWorkflow();
      yield* insertWorkflow(
        OTHER_WORKFLOW_ID,
        COST,
        DateTime.makeUnsafe("2026-10-25T12:04:00Z"),
      );
      yield* claimWorkflow();

      const dao = yield* FellowshipLogsLookupWorkflowDAO;
      const deleted = yield* dao.prune({
        claimedRetentionBefore: DateTime.makeUnsafe("2026-10-25T12:06:00Z"),
        now: CLAIMED_AT,
      });
      const claimedAfterPrune = yield* claimWorkflow();
      const expiredAfterPrune = yield* claimWorkflow({
        jobId: OTHER_JOB_ID,
        workflowId: OTHER_WORKFLOW_ID,
      });

      return { claimedAfterPrune, deleted, expiredAfterPrune };
    }).pipe(E.provide(makeLayer()), runTest);

    expect(result.deleted).toBe(1);
    expect(result.claimedAfterPrune).toEqual({
      reason: "MISSING",
      status: "UNAVAILABLE",
    });
    expect(result.expiredAfterPrune).toEqual({
      reason: "MISSING",
      status: "UNAVAILABLE",
    });
  });
});
