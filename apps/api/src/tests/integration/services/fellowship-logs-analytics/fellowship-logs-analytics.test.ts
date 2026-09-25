import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { FellowshipLogsGateway } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import {
  makeControlledFellowshipLogsFixtureLayer,
  makeFellowshipLogsFetchControl,
  RECORDED_FIGHT,
  RECORDED_FIGHT_PAGE_COUNT,
} from "@frt/api/tests/common/layers/controlled-fellowship-logs-fixture-layer.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsRequestDAO } from "@frt/db/daos/fellowship-logs-request/fellowship-logs-request-dao.ts";

const getReport = FellowshipLogsGateway.use((gateway) => {
  return gateway.getReport(RECORDED_FIGHT);
});

describe("FellowshipLogsAnalytics", () => {
  test("records live requests and cache hits, and saves them when the app shuts down", async () => {
    const control = makeFellowshipLogsFetchControl();

    const summary = await E.gen(function* () {
      yield* getReport.pipe(
        E.andThen(getReport),
        E.provide(makeControlledFellowshipLogsFixtureLayer(control)),
      );

      const requestDAO = yield* FellowshipLogsRequestDAO;

      return yield* requestDAO.getSummary();
    }).pipe(E.provide(makePersistenceTestLayer()), runTest);

    const requestsPerReport = RECORDED_FIGHT_PAGE_COUNT + 1;

    expect(summary).toMatchObject({
      apiRequestCount: requestsPerReport,
      cacheHitCount: requestsPerReport,
    });
  });
});
