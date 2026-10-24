import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import { describe, expect, test } from "vitest";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { makeFellowshipLogsGatewayFileQuery } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-file-query.ts";
import { makeQuery } from "@frt/api/services/fellowship-logs-gateway/query/make-query.ts";
import {
  RATE_LIMIT_DATA_QUERY,
  RATE_LIMIT_DATA_SELECTION,
} from "@frt/api/services/fellowship-logs-gateway/query/rate-limit-data-query.ts";
import {
  REPORT_SELECTION,
  REPORT_VARIABLES,
} from "@frt/api/services/fellowship-logs-gateway/query/report-query.ts";
import { FellowshipLogsGatewayReportResponseDataSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-report-schema.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsRateLimitResponseDataSchema } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";

const REPORT_CODE = "FileQueryReport";

const FIGHT_ID = 3;

const FIGHT_START_TIME = 1000;

const RATE_LIMIT_DATA = {
  limitPerHour: 3600,
  pointsResetIn: 600,
  pointsSpentThisHour: 12,
};

const REPORT_PAGE_QUERY = makeQuery({
  capability: "USER_POINT_ELIGIBLE",
  name: "GetDungeonRunReport",
  selections: [REPORT_SELECTION, RATE_LIMIT_DATA_SELECTION],
  variables: REPORT_VARIABLES,
});

const UNKNOWN_OPERATION_QUERY = makeQuery({
  capability: "UNCLASSIFIED",
  name: "GetSomethingElse",
  selections: [RATE_LIMIT_DATA_SELECTION],
});

const PAGES = [
  { eventTimestamp: 1000, nextPageTimestamp: 1300 },
  { eventTimestamp: 1300, nextPageTimestamp: 1600 },
  { eventTimestamp: 1600, nextPageTimestamp: null },
];

function makeMetadataFile() {
  return {
    data: {
      rateLimitData: RATE_LIMIT_DATA,
      reportData: {
        report: {
          endTime: 5000,
          fights: [
            {
              difficultyLevel: 10,
              encounterID: 100006,
              endTime: 2000,
              id: FIGHT_ID,
              inProgress: false,
              startTime: FIGHT_START_TIME,
            },
          ],
          startTime: 0,
        },
      },
    },
  };
}

function makePageFile({
  eventTimestamp,
  nextPageTimestamp,
}: (typeof PAGES)[number]) {
  return {
    data: {
      rateLimitData: RATE_LIMIT_DATA,
      reportData: {
        report: {
          code: REPORT_CODE,
          endTime: 5000,
          events: {
            data: [{ timestamp: eventTimestamp }],
            nextPageTimestamp,
          },
          masterData: { actors: null, gameVersion: null, logVersion: 1 },
          revision: 1,
          startTime: 0,
          title: "File query test",
        },
      },
    },
  };
}

const makeFixtureQuery = E.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const fixtureDirectory = yield* fileSystem.makeTempDirectoryScoped();
  const fightDirectory = path.join(
    fixtureDirectory,
    `${REPORT_CODE}-fights-${FIGHT_ID}`,
  );

  yield* fileSystem.makeDirectory(fightDirectory);

  yield* fileSystem.writeFileString(
    path.join(fightDirectory, "metadata.json"),
    JSON.stringify(makeMetadataFile()),
  );

  yield* E.forEach(PAGES, (page, index) => {
    return fileSystem.writeFileString(
      path.join(fightDirectory, `page-${index + 1}.json`),
      JSON.stringify(makePageFile(page)),
    );
  });

  return yield* makeFellowshipLogsGatewayFileQuery({ fixtureDirectory });
});

function runFixtureTest<A, Error>(
  effect: E.Effect<A, Error, FileSystem.FileSystem | Path.Path | Scope.Scope>,
) {
  return effect.pipe(E.scoped, E.provide(NodePlatformLayer), runTest);
}

describe("makeFellowshipLogsGatewayFileQuery", () => {
  test("serves each recorded page at the start time the previous page points to", async () => {
    const eventTimestamps = await E.gen(function* () {
      const query = yield* makeFixtureQuery;

      return yield* E.forEach([FIGHT_START_TIME, 1300, 1600], (startTime) => {
        return query(
          {
            query: REPORT_PAGE_QUERY,
            variables: { endTime: 2000, reportCode: REPORT_CODE, startTime },
          },
          FellowshipLogsGatewayReportResponseDataSchema,
        ).pipe(
          E.map((response) => {
            const report = response.data?.reportData.report;

            return report !== null && report !== undefined && "events" in report
              ? report.events.data
              : [];
          }),
        );
      });
    }).pipe(runFixtureTest);

    expect(eventTimestamps).toEqual([
      [{ timestamp: 1000 }],
      [{ timestamp: 1300 }],
      [{ timestamp: 1600 }],
    ]);
  });

  test("fails to read a fixture when no recorded page starts at the requested time", async () => {
    const error = await E.gen(function* () {
      const query = yield* makeFixtureQuery;

      return yield* query(
        {
          query: REPORT_PAGE_QUERY,
          variables: {
            endTime: 2000,
            reportCode: REPORT_CODE,
            startTime: 1450,
          },
        },
        FellowshipLogsGatewayReportResponseDataSchema,
      ).pipe(E.flip);
    }).pipe(runFixtureTest);

    expect(error).toMatchObject({
      _tag: "FellowshipLogsGatewayRequestError",
      operation: "ReadFixture",
    });
  });

  test("answers the unnamed rate limit query from the recorded metadata", async () => {
    const response = await E.gen(function* () {
      const query = yield* makeFixtureQuery;

      return yield* query(
        { query: RATE_LIMIT_DATA_QUERY },
        FellowshipLogsRateLimitResponseDataSchema,
      );
    }).pipe(runFixtureTest);

    expect(response.data?.rateLimitData).toEqual(RATE_LIMIT_DATA);
  });

  test("fails to read a fixture for an operation it doesn't record", async () => {
    const error = await E.gen(function* () {
      const query = yield* makeFixtureQuery;

      return yield* query(
        { query: UNKNOWN_OPERATION_QUERY },
        Schema.Unknown,
      ).pipe(E.flip);
    }).pipe(runFixtureTest);

    expect(error).toMatchObject({
      _tag: "FellowshipLogsGatewayRequestError",
      operation: "ReadFixture",
    });
  });
});
