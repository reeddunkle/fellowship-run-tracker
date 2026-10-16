import * as E from "effect/Effect";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FellowshipLogsGateway } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import {
  CONTROLLED_PAGE_COUNT,
  makeControlledFellowshipLogsFixtureLayer,
  makeFellowshipLogsFetchControl,
  RECORDED_FIGHT,
} from "@frt/api/tests/common/layers/controlled-fellowship-logs-fixture-layer.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsRequestDAO } from "@frt/db/daos/fellowship-logs-request/fellowship-logs-request-dao.ts";

const fetchReportPages = FellowshipLogsGateway.use((gateway) => {
  return Stream.runDrain(gateway.streamReportPages(RECORDED_FIGHT));
});

describe("FellowshipLogsAnalytics", () => {
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
