import * as E from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as TestClock from "effect/testing/TestClock";
import { describe, expect, test } from "vitest";

import { makeFellowshipLogsAnalytics } from "@frt/api/services/fellowship-logs-analytics/make-fellowship-logs-analytics-service.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import {
  FellowshipLogsRequestDAO,
  type FellowshipLogsRequestDAOShape,
} from "@frt/db/daos/fellowship-logs-request/fellowship-logs-request-dao.ts";

const FLUSH_INTERVAL = "2 seconds";

const SAVE_TIMEOUT = "1 second";

function makeRecordingRequestDAO() {
  return E.gen(function* () {
    const savedBatchSizes = yield* Ref.make<ReadonlyArray<number>>([]);
    const savedBatches = yield* Queue.unbounded<number>();

    const requestDAO = {
      getSummary: () => {
        return E.die("unexpected call: getSummary");
      },
      insertMany: (events) => {
        return Ref.update(savedBatchSizes, (batchSizes) => {
          return [...batchSizes, events.length];
        }).pipe(E.andThen(Queue.offer(savedBatches, events.length)));
      },
    } satisfies FellowshipLogsRequestDAOShape;

    const awaitSavedBatches = (batchCount: number) => {
      return TestClock.withLive(
        E.forEach(Array.from({ length: batchCount }), () => {
          return Queue.take(savedBatches);
        }).pipe(E.timeout(SAVE_TIMEOUT)),
      );
    };

    return {
      awaitSavedBatches,
      getSavedBatchSizes: Ref.get(savedBatchSizes),
      requestDAO,
    };
  });
}

function recordEvents(
  analytics: E.Success<typeof makeFellowshipLogsAnalytics>,
  eventCount: number,
) {
  return E.forEach(
    Array.from({ length: eventCount }),
    () => {
      return analytics.record({
        operation: "REPORT_PAGE",
        pointsSpent: null,
        source: "CACHE",
      });
    },
    { discard: true },
  );
}

describe("FellowshipLogsAnalytics batching", () => {
  test("saves a backlog of events without waiting between full batches", async () => {
    const savedBatchSizes = await E.gen(function* () {
      const { awaitSavedBatches, getSavedBatchSizes, requestDAO } =
        yield* makeRecordingRequestDAO();

      const analytics = yield* makeFellowshipLogsAnalytics.pipe(
        E.provideService(FellowshipLogsRequestDAO, requestDAO),
      );

      yield* recordEvents(analytics, 1);

      yield* awaitSavedBatches(1);

      yield* recordEvents(analytics, 250);

      yield* TestClock.adjust(FLUSH_INTERVAL);

      yield* awaitSavedBatches(3);

      return yield* getSavedBatchSizes;
    }).pipe(E.scoped, E.provide(TestClock.layer()), runTest);

    expect(savedBatchSizes).toEqual([1, 100, 100, 50]);
  });
});
