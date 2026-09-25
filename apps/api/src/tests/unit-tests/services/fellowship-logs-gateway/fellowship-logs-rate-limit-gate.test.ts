import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { describe, expect, test } from "vitest";

import {
  FellowshipLogsGatewayRateLimitRejectedError,
  FellowshipLogsGatewayRequestError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { FellowshipLogsAnalytics } from "@frt/api/services/fellowship-logs-analytics/fellowship-logs-analytics-service.ts";
import { FellowshipLogsGatewayResponseCache } from "@frt/api/services/fellowship-logs-gateway/cache/fellowship-logs-gateway-response-cache-service.ts";
import { withFellowshipLogsGatewayPointsSpent } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-points-spent.ts";
import { type Query } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import { makeFellowshipLogsGatewayFromQuery } from "@frt/api/services/fellowship-logs-gateway/make-fellowship-logs-gateway-service.ts";
import { makeFellowshipLogsGatewayGraphQLResponseSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-graphql-schema.ts";
import { ignoredFellowshipLogsAnalytics } from "@frt/api/tests/common/mocks/fellowship-logs-analytics-mock.ts";
import { passThroughFellowshipLogsGatewayResponseCache } from "@frt/api/tests/common/mocks/fellowship-logs-gateway-response-cache-mock.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

const LIMIT_PER_HOUR = 3600;

const RESET_IN_SECONDS = 600;

const RUN = {
  fightId: Schema.decodeSync(FellowshipLogsFightIdSchema)(15),
  reportCode: Schema.decodeSync(FellowshipLogsReportCodeSchema)(
    "XdfFZzgHBJNr6m3v",
  ),
};

type StubResponse =
  | { readonly _tag: "Rejected" }
  | { readonly _tag: "Response"; readonly body: unknown };

function makeRateLimitData(pointsSpentThisHour: number) {
  return {
    limitPerHour: LIMIT_PER_HOUR,
    pointsResetIn: RESET_IN_SECONDS,
    pointsSpentThisHour,
  };
}

function makeMetadataResponse(pointsSpentThisHour: number): StubResponse {
  return {
    _tag: "Response",
    body: {
      data: {
        rateLimitData: makeRateLimitData(pointsSpentThisHour),
        reportData: {
          report: {
            endTime: 2000,
            fights: [
              {
                difficultyLevel: 10,
                encounterID: 100006,
                endTime: 2000,
                id: RUN.fightId,
                inProgress: false,
                startTime: 1000,
              },
            ],
            startTime: 0,
          },
        },
      },
    },
  };
}

function makeRateLimitResponse(pointsSpentThisHour: number): StubResponse {
  return {
    _tag: "Response",
    body: { data: { rateLimitData: makeRateLimitData(pointsSpentThisHour) } },
  };
}

/**
 * A `Query` that answers with `responses` in order, decoding each like the
 * real one does, and counts how many requests were sent.
 */
function makeStubQuery(responses: ReadonlyArray<StubResponse>) {
  const remaining = [...responses];
  const sent = { count: 0 };

  const query: Query = (_request, responseSchema) => {
    return E.gen(function* () {
      sent.count += 1;

      const response = remaining.shift();

      if (response === undefined) {
        return yield* new FellowshipLogsGatewayRequestError({
          cause: new Error("No stub response left."),
          operation: "Query",
        });
      }

      if (response._tag === "Rejected") {
        return yield* new FellowshipLogsGatewayRateLimitRejectedError();
      }

      return yield* Schema.decodeUnknownEffect(
        makeFellowshipLogsGatewayGraphQLResponseSchema(responseSchema),
      )(response.body).pipe(
        E.mapError((cause) => {
          return new FellowshipLogsGatewayRequestError({
            cause,
            operation: "Query",
          });
        }),
      );
    });
  };

  return { query, sent };
}

function runWithTestClock<A, Err>(
  effect: E.Effect<
    A,
    Err,
    FellowshipLogsAnalytics | FellowshipLogsGatewayResponseCache
  >,
) {
  return runTest(
    effect.pipe(
      E.provideService(
        FellowshipLogsGatewayResponseCache,
        passThroughFellowshipLogsGatewayResponseCache,
      ),
      E.provideService(FellowshipLogsAnalytics, ignoredFellowshipLogsAnalytics),
      E.provide(TestClock.layer()),
    ),
  );
}

describe("Fellowship Logs rate-limit gate", () => {
  test("doesn't send a request once the points are used up", async () => {
    const { query, sent } = makeStubQuery([
      makeMetadataResponse(LIMIT_PER_HOUR),
    ]);

    const error = await runWithTestClock(
      E.gen(function* () {
        const fellowshipLogsGateway =
          yield* makeFellowshipLogsGatewayFromQuery(query);

        yield* fellowshipLogsGateway.getDungeonRunMetadata(RUN);

        return yield* fellowshipLogsGateway
          .getDungeonRunMetadata(RUN)
          .pipe(E.flip);
      }),
    );

    expect(sent.count).toBe(1);
    expect(error._tag).toBe("FellowshipLogsGatewayRateLimitExceededError");
    expect(error).toMatchObject({
      reason: "PreflightExhausted",
      resetsAt: DateTime.makeUnsafe(RESET_IN_SECONDS * 1_000),
    });
  });

  test("sends requests again once the reset time passes", async () => {
    const { query, sent } = makeStubQuery([
      makeMetadataResponse(LIMIT_PER_HOUR),
      makeMetadataResponse(10),
    ]);

    await runWithTestClock(
      E.gen(function* () {
        const fellowshipLogsGateway =
          yield* makeFellowshipLogsGatewayFromQuery(query);

        yield* fellowshipLogsGateway.getDungeonRunMetadata(RUN);
        yield* TestClock.adjust(`${RESET_IN_SECONDS} seconds`);
        yield* fellowshipLogsGateway.getDungeonRunMetadata(RUN);
      }),
    );

    expect(sent.count).toBe(2);
  });

  test("always lets the rate limit itself be looked up", async () => {
    const { query, sent } = makeStubQuery([
      makeMetadataResponse(LIMIT_PER_HOUR),
      makeRateLimitResponse(LIMIT_PER_HOUR),
    ]);

    const snapshot = await runWithTestClock(
      E.gen(function* () {
        const fellowshipLogsGateway =
          yield* makeFellowshipLogsGatewayFromQuery(query);

        yield* fellowshipLogsGateway.getDungeonRunMetadata(RUN);
        yield* TestClock.adjust("1 second");

        return yield* fellowshipLogsGateway.getRateLimitData({ force: true });
      }),
    );

    expect(sent.count).toBe(2);
    expect(snapshot).toEqual({
      ...makeRateLimitData(LIMIT_PER_HOUR),
      observedAtMilliseconds: 1_000,
    });
  });

  test("holds back a request that would cost more than the points left", async () => {
    // The second lookup costs 1,000 points, leaving 900: not enough for a
    // third.
    const { query, sent } = makeStubQuery([
      makeMetadataResponse(1_700),
      makeMetadataResponse(2_700),
    ]);

    const error = await runWithTestClock(
      E.gen(function* () {
        const fellowshipLogsGateway =
          yield* makeFellowshipLogsGatewayFromQuery(query);

        yield* fellowshipLogsGateway.getDungeonRunMetadata(RUN);
        yield* fellowshipLogsGateway.getDungeonRunMetadata(RUN);

        return yield* fellowshipLogsGateway
          .getDungeonRunMetadata(RUN)
          .pipe(E.flip);
      }),
    );

    expect(sent.count).toBe(2);
    expect(error._tag).toBe("FellowshipLogsGatewayRateLimitExceededError");
  });

  test("treats a rate-limit GraphQL error as a rejection, keeping its rate-limit data", async () => {
    const { query } = makeStubQuery([
      {
        _tag: "Response",
        body: {
          data: { rateLimitData: makeRateLimitData(LIMIT_PER_HOUR) },
          errors: [{ message: "Rate limit exceeded." }],
        },
      },
    ]);

    const { error, snapshot } = await runWithTestClock(
      E.gen(function* () {
        const fellowshipLogsGateway =
          yield* makeFellowshipLogsGatewayFromQuery(query);

        const flipped = yield* fellowshipLogsGateway
          .getRateLimitData({ force: true })
          .pipe(E.flip);

        return {
          error: flipped,
          snapshot: yield* fellowshipLogsGateway.getRateLimitData(),
        };
      }),
    );

    expect(error).toMatchObject({
      _tag: "FellowshipLogsGatewayRateLimitExceededError",
      reason: "RejectedByApi",
      resetsAt: DateTime.makeUnsafe(RESET_IN_SECONDS * 1_000),
    });
    expect(snapshot?.pointsSpentThisHour).toBe(LIMIT_PER_HOUR);
  });

  test("assumes a short wait when rejected with no rate-limit data", async () => {
    const { query } = makeStubQuery([{ _tag: "Rejected" }]);

    const error = await runWithTestClock(
      E.gen(function* () {
        const fellowshipLogsGateway =
          yield* makeFellowshipLogsGatewayFromQuery(query);

        return yield* fellowshipLogsGateway
          .getDungeonRunMetadata(RUN)
          .pipe(E.flip);
      }),
    );

    expect(error).toMatchObject({
      _tag: "FellowshipLogsGatewayRateLimitExceededError",
      reason: "RejectedByApi",
      resetsAt: DateTime.makeUnsafe(5 * 60 * 1_000),
    });
  });

  test("adds up the measured points spent by the requests it wraps", async () => {
    const { query } = makeStubQuery([
      makeMetadataResponse(100),
      makeMetadataResponse(130),
      makeMetadataResponse(170),
    ]);

    const pointsSpent = await runWithTestClock(
      E.gen(function* () {
        const fellowshipLogsGateway =
          yield* makeFellowshipLogsGatewayFromQuery(query);

        yield* fellowshipLogsGateway.getDungeonRunMetadata(RUN);

        const [, points] = yield* withFellowshipLogsGatewayPointsSpent(
          fellowshipLogsGateway
            .getDungeonRunMetadata(RUN)
            .pipe(E.andThen(fellowshipLogsGateway.getDungeonRunMetadata(RUN))),
        );

        return points;
      }),
    );

    expect(pointsSpent).toBe(70);
  });

  test("falls back to the known cost of a query when a request's cost can't be measured", async () => {
    const { query } = makeStubQuery([
      makeMetadataResponse(100),
      makeMetadataResponse(130),
      makeMetadataResponse(40),
    ]);

    const pointsSpent = await runWithTestClock(
      E.gen(function* () {
        const fellowshipLogsGateway =
          yield* makeFellowshipLogsGatewayFromQuery(query);

        yield* fellowshipLogsGateway.getDungeonRunMetadata(RUN);
        yield* fellowshipLogsGateway.getDungeonRunMetadata(RUN);
        yield* TestClock.adjust(`${RESET_IN_SECONDS} seconds`);

        const [, points] = yield* withFellowshipLogsGatewayPointsSpent(
          fellowshipLogsGateway.getDungeonRunMetadata(RUN),
        );

        return points;
      }),
    );

    expect(pointsSpent).toBe(30);
  });
});
