import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import {
  FellowshipLogsRequestDAO,
  type FellowshipLogsRequestEvent,
} from "@frt/db/daos/fellowship-logs-request/fellowship-logs-request-dao.ts";
import { makeDatabasePersistenceTestLayer } from "@frt/db/tests/common/layers/database-persistence-test-layer.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";

function makeEvent(
  event: Omit<FellowshipLogsRequestEvent, "occurredAt">,
  occurredAtMilliseconds = 1_000,
): FellowshipLogsRequestEvent {
  return {
    ...event,
    occurredAt: DateTime.makeUnsafe(occurredAtMilliseconds),
  };
}

function getSummaryAfterInserting(
  events: ReadonlyArray<FellowshipLogsRequestEvent>,
) {
  return E.gen(function* () {
    const requestDAO = yield* FellowshipLogsRequestDAO;

    yield* requestDAO.insertMany(events);

    return yield* requestDAO.getSummary();
  }).pipe(E.provide(makeDatabasePersistenceTestLayer()), runTest);
}

describe("FellowshipLogsRequestDAO", () => {
  test("summarizes nothing when no requests were recorded", async () => {
    const summary = await getSummaryAfterInserting([]);

    expect(summary).toEqual({
      apiRequestCount: 0,
      cacheHitCount: 0,
      estimatedPointsSaved: 0,
      pointsSpent: 0,
      trackingSince: null,
    });
  });

  test("values each cache hit at the average measured cost of its operation", async () => {
    const summary = await getSummaryAfterInserting([
      makeEvent(
        { operation: "REPORT_PAGE", pointsSpent: 4, source: "API" },
        2_000,
      ),
      makeEvent({ operation: "REPORT_PAGE", pointsSpent: 6, source: "API" }),
      makeEvent({ operation: "REPORT_PAGE", pointsSpent: null, source: "API" }),
      makeEvent({ operation: "FIGHT", pointsSpent: 1, source: "API" }),
      makeEvent({
        operation: "REPORT_PAGE",
        pointsSpent: null,
        source: "CACHE",
      }),
      makeEvent({
        operation: "REPORT_PAGE",
        pointsSpent: null,
        source: "CACHE",
      }),
      makeEvent({ operation: "FIGHT", pointsSpent: null, source: "CACHE" }),
    ]);

    expect(summary).toEqual({
      apiRequestCount: 4,
      cacheHitCount: 3,
      estimatedPointsSaved: 11,
      pointsSpent: 11,
      trackingSince: DateTime.makeUnsafe(1_000),
    });
  });

  test("doesn't count savings for an operation with no measured cost", async () => {
    const summary = await getSummaryAfterInserting([
      makeEvent({
        operation: "DUNGEON_RUN_METADATA",
        pointsSpent: null,
        source: "API",
      }),
      makeEvent({
        operation: "DUNGEON_RUN_METADATA",
        pointsSpent: null,
        source: "CACHE",
      }),
    ]);

    expect(summary).toMatchObject({
      cacheHitCount: 1,
      estimatedPointsSaved: 0,
    });
  });

  test("counts rate-limit checks toward points spent but not live requests", async () => {
    const summary = await getSummaryAfterInserting([
      makeEvent({
        operation: "RATE_LIMIT_DATA",
        pointsSpent: 1,
        source: "API",
      }),
    ]);

    expect(summary).toMatchObject({
      apiRequestCount: 0,
      pointsSpent: 1,
    });
  });
});
