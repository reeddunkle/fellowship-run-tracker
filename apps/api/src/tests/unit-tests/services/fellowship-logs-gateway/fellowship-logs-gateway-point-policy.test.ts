import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipLogsGatewayRequestError } from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { FellowshipLogsAnalytics } from "@frt/api/services/fellowship-logs-analytics/fellowship-logs-analytics-service.ts";
import { FellowshipLogsGatewayResponseCache } from "@frt/api/services/fellowship-logs-gateway/cache/fellowship-logs-gateway-response-cache-service.ts";
import { classifyFellowshipLogsPointPolicyErrors } from "@frt/api/services/fellowship-logs-gateway/classify-fellowship-logs-point-policy-errors.ts";
import { getFellowshipLogsGatewayRequestPolicy } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-point-policy.ts";
import { makeFellowshipLogsGatewayFromQuery } from "@frt/api/services/fellowship-logs-gateway/make-fellowship-logs-gateway-service.ts";
import { DUNGEON_RUN_METADATA_QUERY } from "@frt/api/services/fellowship-logs-gateway/query/get-dungeon-run-metadata-query.ts";
import { GET_FIGHT_QUERY } from "@frt/api/services/fellowship-logs-gateway/query/get-fight-query.ts";
import {
  applyQuerySpending,
  makeQuery,
} from "@frt/api/services/fellowship-logs-gateway/query/make-query.ts";
import { RATE_LIMIT_DATA_QUERY } from "@frt/api/services/fellowship-logs-gateway/query/rate-limit-data-query.ts";
import { REPORT_QUERY } from "@frt/api/services/fellowship-logs-gateway/query/report-query.ts";
import {
  makeFellowshipLogsGatewayGraphQLResponseSchema,
  type Query,
} from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-graphql-schema.ts";
import { ignoredFellowshipLogsAnalytics } from "@frt/api/tests/common/mocks/fellowship-logs-analytics-mock.ts";
import { passThroughFellowshipLogsGatewayResponseCache } from "@frt/api/tests/common/mocks/fellowship-logs-gateway-response-cache-mock.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

const RUN = {
  fightId: Schema.decodeSync(FellowshipLogsFightIdSchema)(15),
  reportCode: Schema.decodeSync(FellowshipLogsReportCodeSchema)(
    "XdfFZzgHBJNr6m3v",
  ),
};

const RATE_LIMIT_DATA = {
  limitPerHour: 3600,
  pointsResetIn: 600,
  pointsSpentThisHour: 10,
};

const OPT_IN_REQUIRED_RESPONSE = {
  data: null,
  errors: [
    {
      locations: [{ column: 1, line: 1 }],
      message:
        "cannot require only user points be spent without authenticating a user and opting into the new point system",
    },
  ],
};

const NON_USER_POINTS_RESPONSE = {
  data: {
    rateLimitData: RATE_LIMIT_DATA,
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
  errors: [
    {
      locations: [{ column: 3, line: 4 }],
      message:
        "attempted to spend non-user points while the @onlySpendUserPoints directive was enabled",
      path: ["reportData", "report", "rankings"],
    },
  ],
};

function makeStubQuery(body: unknown) {
  const query: Query = (_request, responseSchema) => {
    return Schema.decodeUnknownEffect(
      makeFellowshipLogsGatewayGraphQLResponseSchema(responseSchema),
    )(body).pipe(
      E.mapError((cause) => {
        return new FellowshipLogsGatewayRequestError({
          cause,
          operation: "Query",
        });
      }),
    );
  };

  return query;
}

function getDungeonRunMetadataError(body: unknown) {
  return runTest(
    E.gen(function* () {
      const fellowshipLogsGateway = yield* makeFellowshipLogsGatewayFromQuery(
        makeStubQuery(body),
      );

      return yield* fellowshipLogsGateway
        .getDungeonRunMetadata(RUN)
        .pipe(E.flip);
    }).pipe(
      E.provideService(
        FellowshipLogsGatewayResponseCache,
        passThroughFellowshipLogsGatewayResponseCache,
      ),
      E.provideService(FellowshipLogsAnalytics, ignoredFellowshipLogsAnalytics),
    ),
  );
}

describe("getFellowshipLogsGatewayRequestPolicy", () => {
  test("selects one endpoint and one spending policy per profile", () => {
    expect({
      FELLOWSHIP_RUN_TRACKER_USER: getFellowshipLogsGatewayRequestPolicy(
        "FELLOWSHIP_RUN_TRACKER_USER",
      ),
      OWN_CLIENT: getFellowshipLogsGatewayRequestPolicy("OWN_CLIENT"),
      OWN_CLIENT_USER: getFellowshipLogsGatewayRequestPolicy("OWN_CLIENT_USER"),
    }).toEqual({
      FELLOWSHIP_RUN_TRACKER_USER: {
        endpoint: "USER",
        spending: "USER_POINTS_ONLY",
      },
      OWN_CLIENT: { endpoint: "CLIENT", spending: "DEFAULT" },
      OWN_CLIENT_USER: { endpoint: "USER", spending: "DEFAULT" },
    });
  });
});

describe("applyQuerySpending", () => {
  test("leaves a query unchanged under default spending", () => {
    expect(applyQuerySpending(GET_FIGHT_QUERY, "DEFAULT")).toEqual(
      Option.some(GET_FIGHT_QUERY.document),
    );
  });

  test("places the directive after the variable definitions of a named query", () => {
    const query = Option.getOrThrow(
      applyQuerySpending(GET_FIGHT_QUERY, "USER_POINTS_ONLY"),
    );

    expect(query.replaceAll(/\s+/g, " ")).toMatch(
      /^ query GetFight\( \$reportCode: String! \$fightId: Int! \) @onlySpendUserPoints \{ reportData \{/,
    );
  });

  test("places the directive on an anonymous query", () => {
    const query = Option.getOrThrow(
      applyQuerySpending(RATE_LIMIT_DATA_QUERY, "USER_POINTS_ONLY"),
    );

    expect(query.replaceAll(/\s+/g, " ")).toMatch(
      /^ query @onlySpendUserPoints \{ rateLimitData \{/,
    );
  });

  test("refuses a query the directive cannot be placed on", () => {
    expect(
      applyQuerySpending(
        { capability: "USER_POINT_ELIGIBLE", document: "{ ok }" },
        "USER_POINTS_ONLY",
      ),
    ).toEqual(Option.none());
    expect(
      applyQuerySpending(
        makeQuery({
          capability: "USER_POINT_ELIGIBLE",
          name: "Other",
          selections: ["ok @include(if: true)"],
        }),
        "USER_POINTS_ONLY",
      ),
    ).toEqual(Option.none());
  });
});

describe("Fellowship Logs gateway query capabilities", () => {
  test.each([
    ["dungeon-run metadata", DUNGEON_RUN_METADATA_QUERY],
    ["fight", GET_FIGHT_QUERY],
    ["rate-limit data", RATE_LIMIT_DATA_QUERY],
    ["report page", REPORT_QUERY],
  ])(
    "classifies the %s production query as user-point eligible",
    (_name, query) => {
      expect(query.capability).toBe("USER_POINT_ELIGIBLE");
    },
  );
});

describe("classifyFellowshipLogsPointPolicyErrors", () => {
  test("classifies the provider's missing opt-in refusal", () => {
    expect(
      classifyFellowshipLogsPointPolicyErrors(OPT_IN_REQUIRED_RESPONSE.errors),
    ).toEqual(Option.some("PointSystemOptInRequired"));
  });

  test("classifies the provider's field-level non-user-point error", () => {
    expect(
      classifyFellowshipLogsPointPolicyErrors(NON_USER_POINTS_RESPONSE.errors),
    ).toEqual(Option.some("NonUserPointsRequired"));
  });

  test("leaves other errors unclassified", () => {
    expect(
      classifyFellowshipLogsPointPolicyErrors([
        { message: "Report does not exist." },
      ]),
    ).toEqual(Option.none());
    expect(classifyFellowshipLogsPointPolicyErrors(undefined)).toEqual(
      Option.none(),
    );
  });
});

describe("Fellowship Logs gateway point-policy errors", () => {
  test("fails a request refused for a missing opt-in without a retryable error", async () => {
    const error = await getDungeonRunMetadataError(OPT_IN_REQUIRED_RESPONSE);

    expect(error._tag).toBe("FellowshipLogsGatewayPointPolicyError");
    expect(error).toMatchObject({ reason: "PointSystemOptInRequired" });
  });

  test("never uses partial data from a field-level non-user-point error", async () => {
    const error = await getDungeonRunMetadataError(NON_USER_POINTS_RESPONSE);

    expect(error._tag).toBe("FellowshipLogsGatewayPointPolicyError");
    expect(error).toMatchObject({ reason: "NonUserPointsRequired" });
  });
});
