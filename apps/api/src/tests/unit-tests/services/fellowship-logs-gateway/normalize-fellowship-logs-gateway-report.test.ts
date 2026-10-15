import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { normalizeFellowshipLogsGatewayReport } from "@frt/api/services/fellowship-logs-gateway/normalize-fellowship-logs-gateway-report.ts";
import {
  type FellowshipLogsGatewayFilteredReport,
  type FellowshipLogsGatewayReport,
} from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-report-schema.ts";

const commonReportFields = {
  code: "report-code",
  endTime: 200,
  masterData: {
    actors: [],
    gameVersion: 1,
    logVersion: 1,
  },
  revision: 1,
  startTime: 100,
  title: "Report",
};

function makeFilteredReport(
  overrides: Partial<FellowshipLogsGatewayFilteredReport> = {},
): FellowshipLogsGatewayFilteredReport {
  const events = {
    data: [],
    nextPageTimestamp: 150,
  };

  return {
    ...commonReportFields,
    casts: events,
    deaths: events,
    dungeonEnds: events,
    dungeonStarts: events,
    encounterEnds: events,
    encounterStarts: events,
    ...overrides,
  };
}

describe("normalizeFellowshipLogsGatewayReport", () => {
  test("leaves singular event responses unchanged", async () => {
    const report: FellowshipLogsGatewayReport = {
      ...commonReportFields,
      events: {
        data: [{ timestamp: 120, type: "cast" }],
        nextPageTimestamp: null,
      },
    };

    await expect(
      E.runPromise(normalizeFellowshipLogsGatewayReport(report)),
    ).resolves.toBe(report);
  });

  test("merges filtered fields chronologically and keeps their shared cursor", async () => {
    const report = makeFilteredReport({
      casts: {
        data: [
          { timestamp: 130, type: "cast" },
          { timestamp: 170, type: "cast" },
        ],
        nextPageTimestamp: 180,
      },
      deaths: {
        data: [{ timestamp: 160, type: "death" }],
        nextPageTimestamp: 180,
      },
      dungeonEnds: {
        data: [],
        nextPageTimestamp: 180,
      },
      dungeonStarts: {
        data: [{ timestamp: 110, type: "dungeonstart" }],
        nextPageTimestamp: 180,
      },
      encounterEnds: {
        data: [{ timestamp: 155, type: "dungeonencounterend" }],
        nextPageTimestamp: 180,
      },
      encounterStarts: {
        data: [{ timestamp: 145, type: "dungeonencounterstart" }],
        nextPageTimestamp: 180,
      },
    });

    await expect(
      E.runPromise(normalizeFellowshipLogsGatewayReport(report)),
    ).resolves.toMatchObject({
      events: {
        data: [
          { timestamp: 110, type: "dungeonstart" },
          { timestamp: 130, type: "cast" },
          { timestamp: 145, type: "dungeonencounterstart" },
          { timestamp: 155, type: "dungeonencounterend" },
          { timestamp: 160, type: "death" },
          { timestamp: 170, type: "cast" },
        ],
        nextPageTimestamp: 180,
      },
    });
  });

  test("rejects different cursors across filtered fields", async () => {
    const report = makeFilteredReport({
      deaths: {
        data: [],
        nextPageTimestamp: 175,
      },
    });

    await expect(
      E.runPromise(normalizeFellowshipLogsGatewayReport(report)),
    ).rejects.toMatchObject({
      _tag: "FellowshipLogsGatewayRequestError",
      operation: "Query",
    });
  });
});
