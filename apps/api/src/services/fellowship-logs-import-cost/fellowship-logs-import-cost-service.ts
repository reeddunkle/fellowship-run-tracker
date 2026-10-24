import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { FellowshipLogsConnection } from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import {
  addFellowshipLogsGatewayWorkflowCost,
  EMPTY_FELLOWSHIP_LOGS_GATEWAY_WORKFLOW_COST,
  type FellowshipLogsGatewayWorkflowCost,
  withFellowshipLogsGatewayWorkflowCostRef,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-points-spent.ts";
import { getFellowshipLogsGatewayWait } from "@frt/api/services/fellowship-logs-gateway/get-fellowship-logs-gateway-wait.ts";
import { FellowshipLogsImportCostDAO } from "@frt/db/daos/fellowship-logs-import-cost/fellowship-logs-import-cost-dao.ts";
import {
  type FellowshipLogsLookupWorkflowCost,
  FellowshipLogsLookupWorkflowDAO,
} from "@frt/db/daos/fellowship-logs-lookup-workflow/fellowship-logs-lookup-workflow-dao.ts";
import { type BackgroundJobId } from "@frt/shared/background-job/background-job-id-schema.ts";
import {
  FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
  type FellowshipLogsConnectionGeneration,
  type FellowshipLogsConnectionProfile,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import { type FellowshipLogsFightId } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsImportOutcome } from "@frt/shared/fellowship-logs/fellowship-logs-import-cost-schema.ts";
import {
  type FellowshipLogsLookupWorkflowId,
  FellowshipLogsLookupWorkflowIdSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-lookup-workflow-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import {
  type FellowshipLogsImportCostEstimate,
  getFellowshipLogsImportCostEstimate,
} from "@frt/shared/fellowship-logs/get-fellowship-logs-import-cost-estimate.ts";

const ESTIMATE_OBSERVATION_LIMIT = 200;
const LOOKUP_WORKFLOW_TTL = { minutes: 30 } as const;
const CLAIMED_LOOKUP_WORKFLOW_RETENTION = { days: 7 } as const;

type MeasureImportOptions = {
  readonly fightId: FellowshipLogsFightId;
  readonly jobId: BackgroundJobId;
  readonly lookupWorkflowId?: FellowshipLogsLookupWorkflowId;
  readonly reportCode: FellowshipLogsReportCode;
};

type LookupWorkflowReference = {
  readonly connectionGeneration: FellowshipLogsConnectionGeneration;
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
  readonly workflowId: FellowshipLogsLookupWorkflowId;
};

type GetEstimateOptions = {
  readonly includesLookup: boolean;
};

export type FellowshipLogsImportCostShape = {
  readonly claimLookupWorkflow: (
    options: LookupWorkflowReference & { readonly jobId: BackgroundJobId },
  ) => E.Effect<Option.Option<FellowshipLogsGatewayWorkflowCost>>;
  readonly getEstimate: (
    options: GetEstimateOptions,
  ) => E.Effect<Option.Option<FellowshipLogsImportCostEstimate>>;
  readonly measure: (
    options: MeasureImportOptions,
  ) => <A, Err, Requirements>(
    effect: E.Effect<A, Err, Requirements>,
  ) => E.Effect<
    readonly [A, FellowshipLogsGatewayWorkflowCost],
    Err,
    Requirements
  >;
  readonly recordLookupWorkflow: (
    options: Omit<LookupWorkflowReference, "workflowId"> &
      FellowshipLogsGatewayWorkflowCost,
  ) => E.Effect<FellowshipLogsLookupWorkflowId>;
};

function getErrorTag(error: unknown) {
  return typeof error === "object" && error !== null && "_tag" in error
    ? error._tag
    : null;
}

function getOutcome(
  exit: Exit.Exit<unknown, unknown>,
): Option.Option<FellowshipLogsImportOutcome> {
  if (Exit.isSuccess(exit)) {
    return Option.some("SUCCEEDED");
  }

  if (Cause.hasInterruptsOnly(exit.cause)) {
    return Option.some("CANCELLED");
  }

  const error = Option.getOrNull(Cause.findErrorOption(exit.cause));

  if (
    getErrorTag(error) === "FellowshipLogsDungeonRunImportAlreadyImportedError"
  ) {
    return Option.none();
  }

  return Option.some(
    Option.isSome(getFellowshipLogsGatewayWait(error)) ? "DEFERRED" : "FAILED",
  );
}

const makeFellowshipLogsImportCost = E.gen(function* () {
  const connection = yield* FellowshipLogsConnection;
  const crypto = yield* Crypto.Crypto;
  const importCostDAO = yield* FellowshipLogsImportCostDAO;
  const lookupWorkflowDAO = yield* FellowshipLogsLookupWorkflowDAO;

  const getClaimedRetentionBefore = (now: DateTime.Utc) => {
    return DateTime.subtract(now, CLAIMED_LOOKUP_WORKFLOW_RETENTION);
  };

  const recordLookupWorkflow: FellowshipLogsImportCostShape["recordLookupWorkflow"] =
    E.fn("FellowshipLogsImportCost.recordLookupWorkflow")(function* (options) {
      const now = yield* DateTime.now;
      const workflowId = yield* crypto
        .randomUUIDv4()
        .pipe(E.map(FellowshipLogsLookupWorkflowIdSchema.make), E.orDie);

      yield* lookupWorkflowDAO
        .prune({
          claimedRetentionBefore: getClaimedRetentionBefore(now),
          now,
        })
        .pipe(
          E.andThen(
            lookupWorkflowDAO.insert({
              ...options,
              createdAt: now,
              expiresAt: DateTime.add(now, LOOKUP_WORKFLOW_TTL),
              workflowId,
            }),
          ),
          E.catch((error) => {
            return E.logWarning(
              "Couldn't save a Fellowship Logs lookup workflow.",
              { errorTag: error._tag },
            );
          }),
        );

      return workflowId;
    });

  const claimLookupWorkflow: FellowshipLogsImportCostShape["claimLookupWorkflow"] =
    E.fn("FellowshipLogsImportCost.claimLookupWorkflow")(function* (options) {
      const now = yield* DateTime.now;
      const result = yield* lookupWorkflowDAO
        .claim({
          ...options,
          claimedAt: now,
          claimedRetentionBefore: getClaimedRetentionBefore(now),
        })
        .pipe(
          E.catch((error) => {
            return E.logWarning(
              "Couldn't claim a Fellowship Logs lookup workflow.",
              { errorTag: error._tag },
            ).pipe(E.as(null));
          }),
        );

      if (result === null) {
        return Option.none();
      }

      if (result.status === "UNAVAILABLE") {
        yield* E.logWarning("Fellowship Logs lookup cost wasn't correlated.", {
          reason: result.reason,
        });

        return Option.none();
      }

      return Option.some(result.cost);
    });

  const getConnectionSnapshot = () =>
    connection.getSummary().pipe(
      E.map(
        Option.map((summary) => {
          return {
            generation: summary.generation,
            profile: summary.profile,
          };
        }),
      ),
      E.catch((error) => {
        return E.logWarning(
          "Couldn't read the Fellowship Logs connection for import cost tracking.",
          { errorTag: error._tag },
        ).pipe(
          E.as(
            Option.none<{
              readonly generation: FellowshipLogsConnectionGeneration;
              readonly profile: FellowshipLogsConnectionProfile;
            }>(),
          ),
        );
      }),
    );

  const getProfile = () =>
    getConnectionSnapshot().pipe(
      E.map(Option.map((snapshot) => snapshot.profile)),
    );

  const getResumption = (
    jobId: BackgroundJobId,
    profileAtStart: Option.Option<FellowshipLogsConnectionProfile>,
  ) => {
    return importCostDAO.getLatestProfileForJob({ jobId }).pipe(
      E.map((latestProfile) => {
        return {
          followsProfileChange: Option.exists(latestProfile, (profile) => {
            return profile !== Option.getOrNull(profileAtStart);
          }),
          isResumed: Option.isSome(latestProfile),
        };
      }),
      E.catch((error) => {
        return E.logWarning(
          "Couldn't read earlier Fellowship Logs import costs.",
          { errorTag: error._tag },
        ).pipe(E.as({ followsProfileChange: true, isResumed: true }));
      }),
    );
  };

  const saveObservation = E.fnUntraced(function* ({
    cost,
    exit,
    followsProfileChange,
    includesLookup,
    isResumed,
    options: { fightId, jobId, reportCode },
    profileAtStart,
    startedAt,
  }: {
    readonly cost: FellowshipLogsGatewayWorkflowCost;
    readonly exit: Exit.Exit<unknown, unknown>;
    readonly followsProfileChange: boolean;
    readonly includesLookup: boolean;
    readonly isResumed: boolean;
    readonly options: MeasureImportOptions;
    readonly profileAtStart: Option.Option<FellowshipLogsConnectionProfile>;
    readonly startedAt: DateTime.Utc;
  }) {
    const outcome = getOutcome(exit);

    if (
      Option.isNone(outcome) ||
      (cost.apiRequestCount === 0 && cost.cacheHitCount === 0)
    ) {
      return;
    }

    const profileAtEnd = yield* getProfile();
    const profile =
      Option.isSome(profileAtStart) &&
      Option.contains(profileAtEnd, profileAtStart.value)
        ? profileAtStart.value
        : null;

    yield* importCostDAO
      .insert({
        apiRequestCount: cost.apiRequestCount,
        applicationPoints: cost.applicationPoints,
        cacheHitCount: cost.cacheHitCount,
        completedAt: yield* DateTime.now,
        fightId,
        followsProfileChange,
        includesLookup,
        isResumed,
        jobId,
        outcome: outcome.value,
        pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
        profile,
        reportCode,
        startedAt,
        totalPoints: cost.totalPoints,
        unmeasuredRequestCount: cost.unmeasuredRequestCount,
        userPoints: cost.userPoints,
      })
      .pipe(
        E.catch((error) => {
          return E.logWarning("Couldn't save a Fellowship Logs import cost.", {
            errorTag: error._tag,
          });
        }),
      );
  });

  const measure: FellowshipLogsImportCostShape["measure"] =
    (options) => (effect) => {
      return E.gen(function* () {
        const startedAt = yield* DateTime.now;
        const connectionAtStart = yield* getConnectionSnapshot();
        const profileAtStart = Option.map(
          connectionAtStart,
          (snapshot) => snapshot.profile,
        );
        const { followsProfileChange, isResumed } = yield* getResumption(
          options.jobId,
          profileAtStart,
        );
        const claimedLookup = yield* E.gen(function* () {
          if (
            options.lookupWorkflowId === undefined ||
            Option.isNone(connectionAtStart)
          ) {
            return Option.none<{
              readonly cost: FellowshipLogsLookupWorkflowCost;
              readonly workflowId: FellowshipLogsLookupWorkflowId;
            }>();
          }

          const workflowId = options.lookupWorkflowId;
          const cost = yield* claimLookupWorkflow({
            connectionGeneration: connectionAtStart.value.generation,
            fightId: options.fightId,
            jobId: options.jobId,
            reportCode: options.reportCode,
            workflowId,
          });

          return Option.map(cost, (value) => ({
            cost: value,
            workflowId,
          }));
        });
        const workflowCost = yield* Ref.make(
          Option.match(claimedLookup, {
            onNone: () => {
              return EMPTY_FELLOWSHIP_LOGS_GATEWAY_WORKFLOW_COST;
            },
            onSome: ({ cost }) => cost,
          }),
        );
        const deleteClaimedLookup = Option.match(claimedLookup, {
          onNone: () => E.void,
          onSome: ({ workflowId }) => {
            return lookupWorkflowDAO
              .deleteClaimed({ jobId: options.jobId, workflowId })
              .pipe(
                E.catch((error) => {
                  return E.logWarning(
                    "Couldn't delete a consumed Fellowship Logs lookup workflow.",
                    { errorTag: error._tag },
                  );
                }),
              );
          },
        });

        const result = yield* effect.pipe(
          withFellowshipLogsGatewayWorkflowCostRef(workflowCost),
          E.onExit((exit) => {
            return Ref.get(workflowCost).pipe(
              E.tap(addFellowshipLogsGatewayWorkflowCost),
              E.flatMap((cost) => {
                return saveObservation({
                  cost,
                  exit,
                  followsProfileChange,
                  includesLookup: Option.isSome(claimedLookup),
                  isResumed,
                  options,
                  profileAtStart,
                  startedAt,
                });
              }),
              E.ensuring(deleteClaimedLookup),
            );
          }),
        );

        return [result, yield* Ref.get(workflowCost)] as const;
      });
    };

  const getEstimate: FellowshipLogsImportCostShape["getEstimate"] = E.fn(
    "FellowshipLogsImportCost.getEstimate",
  )(function* ({ includesLookup }) {
    const profile = yield* getProfile();

    if (Option.isNone(profile)) {
      return Option.none();
    }

    const observations = yield* importCostDAO
      .listRecent({
        limit: ESTIMATE_OBSERVATION_LIMIT,
        profile: profile.value,
      })
      .pipe(
        E.catch((error) => {
          return E.logWarning("Couldn't read Fellowship Logs import costs.", {
            errorTag: error._tag,
          }).pipe(E.as([]));
        }),
      );

    return Option.some(
      getFellowshipLogsImportCostEstimate(
        observations.map((observation) => {
          return {
            apiRequestCount: observation.apiRequestCount,
            applicationPoints: observation.applicationPoints,
            cacheHitCount: observation.cacheHitCount,
            completedAtMilliseconds: DateTime.toEpochMillis(
              observation.completedAt,
            ),
            followsProfileChange: observation.followsProfileChange,
            includesLookup: observation.includesLookup,
            isResumed: observation.isResumed,
            outcome: observation.outcome,
            pointPolicyVersion: observation.pointPolicyVersion,
            profile: observation.profile,
            totalPoints: observation.totalPoints,
            unmeasuredRequestCount: observation.unmeasuredRequestCount,
            userPoints: observation.userPoints,
          };
        }),
        {
          includesLookup,
          pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
          profile: profile.value,
        },
      ),
    );
  });

  return {
    claimLookupWorkflow,
    getEstimate,
    measure,
    recordLookupWorkflow,
  } satisfies FellowshipLogsImportCostShape;
});

export class FellowshipLogsImportCost extends Context.Service<
  FellowshipLogsImportCost,
  FellowshipLogsImportCostShape
>()(
  "@frt/api/services/fellowship-logs-import-cost/fellowship-logs-import-cost-service/FellowshipLogsImportCost",
) {
  static readonly layerNoDeps = Layer.effect(
    this,
    makeFellowshipLogsImportCost,
  );

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(NodeCrypto.layer),
  );
}
