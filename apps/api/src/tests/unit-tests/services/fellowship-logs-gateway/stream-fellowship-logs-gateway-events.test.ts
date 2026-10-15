import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { streamFellowshipLogsGatewayEvents } from "@frt/api/services/fellowship-logs-gateway/events/stream-fellowship-logs-gateway-events.ts";
import { type FellowshipLogsGatewayReport } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-report-schema.ts";

describe("streamFellowshipLogsGatewayEvents", () => {
  test("converts dungeon encounter boundaries", async () => {
    const reportStartTime = 1_787_703_684_668;
    const report: FellowshipLogsGatewayReport = {
      code: "XdfFZzgHBJNr6m3v",
      endTime: reportStartTime + 1_000,
      events: {
        data: [
          {
            encounterID: 31,
            name: "Sin-Magir",
            timestamp: 100,
            type: "dungeonencounterstart",
          },
          {
            encounterID: 31,
            kill: true,
            name: "Sin-Magir",
            timestamp: 900,
            type: "dungeonencounterend",
          },
        ],
        nextPageTimestamp: null,
      },
      masterData: {
        actors: [],
        gameVersion: 1,
        logVersion: 1,
      },
      revision: 1,
      startTime: reportStartTime,
      title: "Report",
    };

    const events = await E.runPromise(
      Stream.succeed(report).pipe(
        streamFellowshipLogsGatewayEvents,
        Stream.runCollect,
        E.map(Array.from),
      ),
    );

    expect(events).toEqual([
      {
        encounterId: "31",
        encounterNames: ["Sin-Magir"],
        timestamp: DateTime.makeUnsafe(reportStartTime + 100),
        type: "ENCOUNTER_START",
      },
      {
        encounterId: "31",
        encounterNames: ["Sin-Magir"],
        succeeded: true,
        timestamp: DateTime.makeUnsafe(reportStartTime + 900),
        type: "ENCOUNTER_END",
      },
    ]);
  });
});
