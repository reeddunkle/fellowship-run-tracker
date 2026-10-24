import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FellowshipLogsAnalytics } from "@frt/api/services/fellowship-logs-analytics/fellowship-logs-analytics-service.ts";
import { FellowshipLogsGatewayResponseCache } from "@frt/api/services/fellowship-logs-gateway/cache/fellowship-logs-gateway-response-cache-service.ts";
import { FellowshipLogsGateway } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import { makeFellowshipLogsGatewayFromQuery } from "@frt/api/services/fellowship-logs-gateway/make-fellowship-logs-gateway-service.ts";
import {
  makeFellowshipLogsGatewayGraphQLResponseSchema,
  type Query,
} from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-graphql-schema.ts";
import {
  CONTROLLED_PAGE_COUNT,
  makeControlledFellowshipLogsFixtureLayer,
  makeFellowshipLogsFetchControl,
  RECORDED_FIGHT,
} from "@frt/api/tests/common/layers/controlled-fellowship-logs-fixture-layer.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { passThroughFellowshipLogsGatewayResponseCache } from "@frt/api/tests/common/mocks/fellowship-logs-gateway-response-cache-mock.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsRequestDAO } from "@frt/db/daos/fellowship-logs-request/fellowship-logs-request-dao.ts";
import { AnalyticsDatabase } from "@frt/db/databases/analytics-database.ts";

const fetchReportPages = FellowshipLogsGateway.use((gateway) => {
  return Stream.runDrain(gateway.streamReportPages(RECORDED_FIGHT));
});

describe("FellowshipLogsAnalytics", () => {
  test("does not persist marker secrets from provider responses", async () => {
    const markerSecret = "marker-analytics-secret-2cc78457";
    const query: Query = E.fnUntraced(function* (_request, responseSchema) {
      return yield* Schema.decodeEffect(
        makeFellowshipLogsGatewayGraphQLResponseSchema(responseSchema),
      )({
        data: {
          markerSecret,
          rateLimitData: {
            limitPerHour: 3_600,
            pointsResetIn: 600,
            pointsSpentThisHour: 12,
          },
        },
      }).pipe(E.orDie);
    });

    const rows = await E.gen(function* () {
      const sql = yield* AnalyticsDatabase;

      yield* E.scoped(
        E.gen(function* () {
          const gateway = yield* makeFellowshipLogsGatewayFromQuery(query);

          yield* gateway.getRateLimitData({ force: true });
        }).pipe(
          E.provide(FellowshipLogsAnalytics.layer),
          E.provideService(
            FellowshipLogsGatewayResponseCache,
            passThroughFellowshipLogsGatewayResponseCache,
          ),
        ),
      );

      return yield* sql`SELECT * FROM fellowship_logs_request`;
    }).pipe(E.provide(makePersistenceTestLayer()), runTest);

    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(markerSecret);
  });

  test("records live requests and cache hits, and saves them when the app shuts down", async () => {
    const control = makeFellowshipLogsFetchControl();

    const summary = await E.gen(function* () {
      yield* fetchReportPages.pipe(
        E.andThen(fetchReportPages),
        E.provide(makeControlledFellowshipLogsFixtureLayer(control)),
      );

      const requestDAO = yield* FellowshipLogsRequestDAO;

      return yield* requestDAO.getSummary();
    }).pipe(E.provide(makePersistenceTestLayer()), runTest);

    const requestsPerReport = CONTROLLED_PAGE_COUNT + 1;

    expect(summary).toMatchObject({
      apiRequestCount: requestsPerReport,
      cacheHitCount: requestsPerReport,
    });
  });
});
