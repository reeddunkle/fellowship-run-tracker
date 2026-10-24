import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FellowshipLogsDungeonRunImportAlreadyImportedError } from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import {
  FellowshipLogsGatewayAccessError,
  FellowshipLogsGatewayRateLimitExceededError,
  FellowshipLogsGatewayRequestError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import {
  FellowshipLogsConnection,
  type FellowshipLogsConnectionShape,
} from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import {
  addFellowshipLogsGatewayRequestCost,
  EMPTY_FELLOWSHIP_LOGS_GATEWAY_WORKFLOW_COST,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-points-spent.ts";
import { FellowshipLogsImportCost } from "@frt/api/services/fellowship-logs-import-cost/fellowship-logs-import-cost-service.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsImportCostDAO } from "@frt/db/daos/fellowship-logs-import-cost/fellowship-logs-import-cost-dao.ts";
import {
  FellowshipLogsLookupWorkflowDAO,
  type FellowshipLogsLookupWorkflowDAOShape,
} from "@frt/db/daos/fellowship-logs-lookup-workflow/fellowship-logs-lookup-workflow-dao.ts";
import { makeAnalyticsDatabaseLayer } from "@frt/db/databases/analytics-database.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
  FellowshipLogsConnectionGenerationSchema,
  type FellowshipLogsConnectionProfile,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsLookupWorkflowIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-lookup-workflow-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

const CLIENT_ID = Schema.decodeSync(FellowshipLogsClientIdSchema)("client-id");

const JOB_ID = Schema.decodeSync(BackgroundJobIdSchema)(
  "0190a5f2-0000-7000-8000-000000000001",
);
const LOOKUP_WORKFLOW_ID = Schema.decodeSync(
  FellowshipLogsLookupWorkflowIdSchema,
)("00000000-0000-4000-8000-000000000000");

const RUN = {
  fightId: Schema.decodeSync(FellowshipLogsFightIdSchema)(15),
  jobId: JOB_ID,
  lookupWorkflowId: LOOKUP_WORKFLOW_ID,
  reportCode: Schema.decodeSync(FellowshipLogsReportCodeSchema)(
    "XdfFZzgHBJNr6m3v",
  ),
};

const DUNGEON_RUN_ID = Schema.decodeSync(DungeonRunIdSchema)("run");

const LOOKUP_COST = {
  ...EMPTY_FELLOWSHIP_LOGS_GATEWAY_WORKFLOW_COST,
  apiRequestCount: 1,
  totalPoints: 4,
  userPoints: 4,
};

const spendUserPoints = (total: number) => {
  return addFellowshipLogsGatewayRequestCost({
    estimatedPoints: 0,
    measured: Option.some({ application: 0, total, user: total }),
  });
};

function makeConnection(
  profiles: Array<FellowshipLogsConnectionProfile>,
): FellowshipLogsConnectionShape {
  return {
    changes: Stream.empty,
    disconnect: () => E.die("Unexpected disconnect."),
    getCredentials: () => E.die("Unexpected credentials read."),
    getSummary: () => {
      const profile = profiles.length > 1 ? profiles.shift() : profiles[0];

      return E.succeed(
        Option.fromUndefinedOr(profile).pipe(
          Option.map((value) => {
            return {
              clientId: CLIENT_ID,
              connectedUserId: null,
              connectedUserName: null,
              generation: FellowshipLogsConnectionGenerationSchema.make(
                "7c3f4a1e-2b5d-4c8e-9f60-1a2b3c4d5e6f",
              ),
              pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
              profile: value,
              status: "CONNECTED" as const,
              storageProtection: "OS_BACKED" as const,
            };
          }),
        ),
      );
    },
    replaceTokens: () => E.die("Unexpected token replacement."),
    requireReauthorization: () => E.die("Unexpected reauthorization."),
    saveAuthorizedSession: () => E.die("Unexpected session save."),
    saveOwnClient: () => E.die("Unexpected client save."),
    setPointSystemOptInRequired: () => E.die("Unexpected opt-in update."),
    withRequestLease: (effect) => effect,
  };
}

function makeTestLayer({
  hasLookup = true,
  profiles = ["FELLOWSHIP_RUN_TRACKER_USER"],
}: {
  readonly hasLookup?: boolean;
  readonly profiles?: Array<FellowshipLogsConnectionProfile>;
} = {}) {
  const AnalyticsLayer = FellowshipLogsImportCostDAO.layer.pipe(
    Layer.provideMerge(makeAnalyticsDatabaseLayer(":memory:")),
  );
  const lookupWorkflowDAO: FellowshipLogsLookupWorkflowDAOShape = {
    claim: () =>
      E.succeed(
        hasLookup
          ? { cost: LOOKUP_COST, status: "CLAIMED" }
          : { reason: "MISSING", status: "UNAVAILABLE" },
      ),
    deleteClaimed: () => E.void,
    insert: () => E.die("Unexpected lookup workflow insert."),
    prune: () => E.die("Unexpected lookup workflow prune."),
  };

  return FellowshipLogsImportCost.layerNoDeps.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        AnalyticsLayer,
        NodeCrypto.layer,
        Layer.succeed(FellowshipLogsConnection, makeConnection(profiles)),
        Layer.succeed(FellowshipLogsLookupWorkflowDAO, lookupWorkflowDAO),
      ),
    ),
  );
}

const listObservations = FellowshipLogsImportCostDAO.use((dao) => {
  return dao.listRecent({ limit: 10 });
});

describe("FellowshipLogsImportCost.measure", () => {
  test("records a completed import including the lookup that preceded it", async () => {
    const result = await E.gen(function* () {
      const importCost = yield* FellowshipLogsImportCost;

      const [value, cost] = yield* spendUserPoints(5).pipe(
        E.andThen(spendUserPoints(6)),
        E.as("imported"),
        importCost.measure(RUN),
      );

      return { cost, observations: yield* listObservations, value };
    }).pipe(E.provide(makeTestLayer()), runTest);

    expect(result.value).toBe("imported");
    expect(result.cost).toMatchObject({ apiRequestCount: 3, totalPoints: 15 });
    expect(result.observations).toEqual([
      expect.objectContaining({
        apiRequestCount: 3,
        cacheHitCount: 0,
        includesLookup: true,
        isResumed: false,
        outcome: "SUCCEEDED",
        pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        totalPoints: 15,
        userPoints: 15,
      }),
    ]);
  });

  test("continues an import without lookup cost when correlation is unavailable", async () => {
    const observations = await E.gen(function* () {
      const importCost = yield* FellowshipLogsImportCost;

      yield* spendUserPoints(5).pipe(importCost.measure(RUN));

      return yield* listObservations;
    }).pipe(E.provide(makeTestLayer({ hasLookup: false })), runTest);

    expect(observations).toEqual([
      expect.objectContaining({
        includesLookup: false,
        totalPoints: 5,
      }),
    ]);
  });

  test("records a deferred attempt and marks the next attempt for the same job as resumed", async () => {
    const observations = await E.gen(function* () {
      const importCost = yield* FellowshipLogsImportCost;

      yield* spendUserPoints(5).pipe(
        E.andThen(
          E.fail(
            new FellowshipLogsGatewayRateLimitExceededError({
              reason: "UserPointsExhausted",
              resetsAt: DateTime.makeUnsafe(0),
            }),
          ),
        ),
        importCost.measure(RUN),
        E.ignore,
      );
      yield* spendUserPoints(6).pipe(importCost.measure(RUN));

      return yield* listObservations;
    }).pipe(E.provide(makeTestLayer({ hasLookup: false })), runTest);

    expect(
      observations.map((observation) => {
        return [observation.outcome, observation.isResumed];
      }),
    ).toEqual(
      expect.arrayContaining([
        ["DEFERRED", false],
        ["SUCCEEDED", true],
      ]),
    );
  });

  test("records that a resumed attempt follows a profile change", async () => {
    const observations = await E.gen(function* () {
      const importCost = yield* FellowshipLogsImportCost;

      yield* spendUserPoints(5).pipe(
        E.andThen(
          E.fail(
            new FellowshipLogsGatewayRateLimitExceededError({
              reason: "UserPointsExhausted",
              resetsAt: DateTime.makeUnsafe(0),
            }),
          ),
        ),
        importCost.measure(RUN),
        E.ignore,
      );
      yield* spendUserPoints(6).pipe(importCost.measure(RUN));

      return yield* listObservations;
    }).pipe(
      E.provide(
        makeTestLayer({
          hasLookup: false,
          profiles: [
            "FELLOWSHIP_RUN_TRACKER_USER",
            "FELLOWSHIP_RUN_TRACKER_USER",
            "OWN_CLIENT_USER",
          ],
        }),
      ),
      runTest,
    );

    expect(
      observations.map((observation) => {
        return [
          observation.outcome,
          observation.profile,
          observation.followsProfileChange,
        ];
      }),
    ).toEqual(
      expect.arrayContaining([
        ["DEFERRED", "FELLOWSHIP_RUN_TRACKER_USER", false],
        ["SUCCEEDED", "OWN_CLIENT_USER", true],
      ]),
    );
  });

  test("records a failed attempt", async () => {
    const observations = await E.gen(function* () {
      const importCost = yield* FellowshipLogsImportCost;

      yield* E.fail(
        new FellowshipLogsGatewayRequestError({
          cause: null,
          operation: "Query",
        }),
      ).pipe(importCost.measure(RUN), E.ignore);

      return yield* listObservations;
    }).pipe(E.provide(makeTestLayer()), runTest);

    expect(observations).toEqual([
      expect.objectContaining({ outcome: "FAILED" }),
    ]);
  });

  test("records an attempt that waits for the connection as deferred", async () => {
    const observations = await E.gen(function* () {
      const importCost = yield* FellowshipLogsImportCost;

      yield* E.fail(
        new FellowshipLogsGatewayAccessError({
          cause: null,
          reason: "ReauthorizationRequired",
        }),
      ).pipe(importCost.measure(RUN), E.ignore);

      return yield* listObservations;
    }).pipe(E.provide(makeTestLayer()), runTest);

    expect(observations).toEqual([
      expect.objectContaining({ outcome: "DEFERRED" }),
    ]);
  });

  test("records nothing for an attempt that never reached Fellowship Logs, so a later attempt still follows the profile change", async () => {
    const observations = await E.gen(function* () {
      const importCost = yield* FellowshipLogsImportCost;

      yield* spendUserPoints(5).pipe(
        E.andThen(
          E.fail(
            new FellowshipLogsGatewayRateLimitExceededError({
              reason: "UserPointsExhausted",
              resetsAt: DateTime.makeUnsafe(0),
            }),
          ),
        ),
        importCost.measure(RUN),
        E.ignore,
      );
      yield* E.fail(
        new FellowshipLogsGatewayAccessError({
          cause: null,
          reason: "ConnectionChanged",
        }),
      ).pipe(importCost.measure(RUN), E.ignore);
      yield* spendUserPoints(6).pipe(importCost.measure(RUN));

      return yield* listObservations;
    }).pipe(
      E.provide(
        makeTestLayer({
          hasLookup: false,
          profiles: [
            "FELLOWSHIP_RUN_TRACKER_USER",
            "FELLOWSHIP_RUN_TRACKER_USER",
            "OWN_CLIENT_USER",
          ],
        }),
      ),
      runTest,
    );

    expect(
      observations.map((observation) => {
        return [observation.outcome, observation.followsProfileChange];
      }),
    ).toEqual(
      expect.arrayContaining([
        ["DEFERRED", false],
        ["SUCCEEDED", true],
      ]),
    );
    expect(observations).toHaveLength(2);
  });

  test("records nothing for a run that was already imported", async () => {
    const observations = await E.gen(function* () {
      const importCost = yield* FellowshipLogsImportCost;

      yield* E.fail(
        new FellowshipLogsDungeonRunImportAlreadyImportedError({
          dungeonRunId: DUNGEON_RUN_ID,
          fightId: RUN.fightId,
          reportCode: RUN.reportCode,
        }),
      ).pipe(importCost.measure(RUN), E.ignore);

      return yield* listObservations;
    }).pipe(E.provide(makeTestLayer()), runTest);

    expect(observations).toEqual([]);
  });

  test("records no profile when the connection changes during the import", async () => {
    const observations = await E.gen(function* () {
      const importCost = yield* FellowshipLogsImportCost;

      yield* spendUserPoints(5).pipe(importCost.measure(RUN));

      return yield* listObservations;
    }).pipe(
      E.provide(
        makeTestLayer({
          profiles: ["FELLOWSHIP_RUN_TRACKER_USER", "OWN_CLIENT_USER"],
        }),
      ),
      runTest,
    );

    expect(observations).toEqual([
      expect.objectContaining({ outcome: "SUCCEEDED", profile: null }),
    ]);
  });
});

describe("FellowshipLogsImportCost.getEstimate", () => {
  test("shows the exact cost of the latest import for the current profile", async () => {
    const estimate = await E.gen(function* () {
      const importCost = yield* FellowshipLogsImportCost;

      yield* spendUserPoints(9).pipe(importCost.measure(RUN));

      return yield* importCost.getEstimate({ includesLookup: true });
    }).pipe(E.provide(makeTestLayer()), runTest);

    expect(estimate).toEqual(
      Option.some({
        latest: expect.objectContaining({ totalPoints: 13, userPoints: 13 }),
        range: null,
      }),
    );
  });
});

import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
