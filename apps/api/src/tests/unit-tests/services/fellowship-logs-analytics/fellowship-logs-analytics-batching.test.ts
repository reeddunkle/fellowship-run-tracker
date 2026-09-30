import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import { describe, expect, test } from "vitest";

import { FellowshipLogsAnalytics } from "@frt/api/services/fellowship-logs-analytics/fellowship-logs-analytics-service.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsRequestDAO } from "@frt/db/daos/fellowship-logs-request/fellowship-logs-request-dao.ts";

const MOCK_TIMEOUT = "1 second";

describe("FellowshipLogsAnalytics batching", () => {
  test("saves a backlog of events without waiting between full batches", async () => {
    const eventCount = 1_000;

    const savedEventCount = await E.gen(function* () {
      const savedEvents = yield* Ref.make(0);

      const requestDAOLayer = Layer.succeed(FellowshipLogsRequestDAO, {
        getSummary: () => {
          return E.die("unexpected call: getSummary");
        },
        insertMany: (events) => {
          return Ref.update(savedEvents, (count) => {
            return count + events.length;
          });
        },
      });

      return yield* E.scoped(
        E.gen(function* () {
          const analytics = yield* FellowshipLogsAnalytics;

          yield* E.forEach(
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

          yield* Ref.get(savedEvents).pipe(
            E.repeat({
              until: (count) => {
                return count >= eventCount;
              },
            }),
            E.timeout(MOCK_TIMEOUT),
          );

          return yield* Ref.get(savedEvents);
        }).pipe(
          E.provide(
            FellowshipLogsAnalytics.layerNoDeps.pipe(
              Layer.provide(requestDAOLayer),
            ),
          ),
        ),
      );
    }).pipe(runTest);

    expect(savedEventCount).toBe(eventCount);
  });
});
