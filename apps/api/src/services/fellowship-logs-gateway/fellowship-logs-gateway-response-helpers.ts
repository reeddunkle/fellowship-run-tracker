import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import type * as Schema from "effect/Schema";

import {
  FellowshipLogsGatewayGraphQLResponseError,
  FellowshipLogsGatewayPointPolicyError,
  FellowshipLogsGatewayRateLimitExceededError,
  type FellowshipLogsGatewayRateLimitExceededErrorReason,
  type FellowshipLogsGatewayRateLimitRejectedError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { FellowshipLogsAnalytics } from "@frt/api/services/fellowship-logs-analytics/fellowship-logs-analytics-service.ts";
import { classifyFellowshipLogsPointPolicyErrors } from "@frt/api/services/fellowship-logs-gateway/classify-fellowship-logs-point-policy-errors.ts";
import {
  type FellowshipLogsGatewayRequestContext,
  type FellowshipLogsGatewaySpending,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-point-policy.ts";
import { addFellowshipLogsGatewayRequestCost } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-points-spent.ts";
import {
  type FellowshipLogsGatewayGraphQLError,
  type FellowshipLogsGatewayGraphQLRequest,
  type FellowshipLogsGatewayGraphQLResponse,
  type FellowshipLogsGatewayQueryError,
  type Query,
} from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-graphql-schema.ts";
import { type FellowshipLogsRequestOperation } from "@frt/db/validation/fellowship-logs-request/fellowship-logs-request-schema.ts";
import {
  type FellowshipLogsRateLimitData,
  type FellowshipLogsRateLimitSnapshot,
} from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import { getFellowshipLogsPointPools } from "@frt/shared/fellowship-logs/get-fellowship-logs-point-pools.ts";
import { getFellowshipLogsRateLimitStatus } from "@frt/shared/fellowship-logs/get-fellowship-logs-rate-limit-status.ts";
import { getFellowshipLogsRequestCost } from "@frt/shared/fellowship-logs/get-fellowship-logs-request-cost.ts";

export const getGraphQLResponseData = E.fn("getGraphQLResponseData")(function* <
  Data,
>(response: FellowshipLogsGatewayGraphQLResponse<Data>) {
  if (response.errors !== undefined && response.errors.length > 0) {
    return yield* new FellowshipLogsGatewayGraphQLResponseError({
      errors: response.errors,
      reason: "ErrorsReturned",
    });
  }

  if (response.data === undefined || response.data === null) {
    return yield* new FellowshipLogsGatewayGraphQLResponseError({
      errors: response.errors ?? [],
      reason: "MissingData",
    });
  }

  return response.data;
});

type ResponseDataWithRateLimit = {
  readonly rateLimitData?: FellowshipLogsRateLimitData;
};

const UNKNOWN_RESET_DELAY = Duration.minutes(5);

type TrackRequestOptions = {
  readonly costKey: string;
  readonly operation: FellowshipLogsRequestOperation;
};

type TrackResponseOptions = TrackRequestOptions & {
  readonly skipCapacityCheck?: boolean;
};

type TrackOptions = TrackRequestOptions & {
  readonly connectionIdentity: string | null;
  readonly wasRefused: boolean;
};

type FellowshipLogsGatewayRateLimitDataTracker = {
  readonly checkCapacity: (
    costKey: string,
    context: FellowshipLogsGatewayRequestContext,
  ) => E.Effect<void, FellowshipLogsGatewayRateLimitExceededError>;
  readonly getLastKnown: (
    connectionIdentity: string | null,
  ) => E.Effect<FellowshipLogsRateLimitSnapshot | null>;
  readonly getRejectedError: (
    context: FellowshipLogsGatewayRequestContext,
  ) => E.Effect<FellowshipLogsGatewayRateLimitExceededError>;
  readonly track: (
    rateLimitData: FellowshipLogsRateLimitData | undefined,
    options: TrackOptions,
  ) => E.Effect<void>;
};

type RateLimitTrackerState = {
  readonly connectionIdentity: string | null;
  readonly costByKey: Readonly<Record<string, number>>;
  readonly snapshot: FellowshipLogsRateLimitSnapshot | null;
};

function makeEmptyTrackerState(
  connectionIdentity: string | null,
): RateLimitTrackerState {
  return { connectionIdentity, costByKey: {}, snapshot: null };
}

function getTrackerStateFor(
  state: RateLimitTrackerState,
  connectionIdentity: string | null,
): RateLimitTrackerState {
  return state.connectionIdentity === connectionIdentity
    ? state
    : makeEmptyTrackerState(connectionIdentity);
}

const APPLICATION_POINTS_HELD_PER_REQUEST = 1;

type CapacityFailure = {
  readonly reason: FellowshipLogsGatewayRateLimitExceededErrorReason;
  readonly resetsAtMilliseconds: number;
};

function getUserPointsOnlyCapacityFailure(
  snapshot: FellowshipLogsRateLimitSnapshot,
  nowMilliseconds: number,
): Option.Option<CapacityFailure> {
  const pools = getFellowshipLogsPointPools(snapshot, nowMilliseconds);
  const userResetsAtMilliseconds =
    pools.USER.resetsAtMilliseconds ??
    snapshot.observedAtMilliseconds + Duration.toMillis(UNKNOWN_RESET_DELAY);

  if (
    pools.USER.hasRemainingPoints === false &&
    nowMilliseconds < userResetsAtMilliseconds
  ) {
    return Option.some({
      reason: "UserPointsExhausted",
      resetsAtMilliseconds: userResetsAtMilliseconds,
    });
  }

  const application = pools.APPLICATION;

  if (
    application.pointsRemaining !== null &&
    application.resetsAtMilliseconds !== null &&
    application.pointsRemaining < APPLICATION_POINTS_HELD_PER_REQUEST
  ) {
    return Option.some({
      reason: "ApplicationHoldUnavailable",
      resetsAtMilliseconds: application.resetsAtMilliseconds,
    });
  }

  return Option.none();
}

function isRateLimitGraphQLError(error: FellowshipLogsGatewayGraphQLError) {
  return /rate.?limit/i.test(error.message);
}

export function getReportPageProgress({
  endTime,
  nextPageTimestamp,
  startTime,
}: {
  readonly endTime: number;
  readonly nextPageTimestamp: number | null;
  readonly startTime: number;
}): number {
  const duration = endTime - startTime;

  if (nextPageTimestamp === null || duration <= 0) {
    return 1;
  }

  return Math.min(Math.max((nextPageTimestamp - startTime) / duration, 0), 1);
}

function getRequestCost({
  nowMilliseconds,
  previous,
  rateLimitData,
}: {
  readonly nowMilliseconds: number;
  readonly previous: FellowshipLogsRateLimitSnapshot | null;
  readonly rateLimitData: FellowshipLogsRateLimitData;
}) {
  if (
    previous === null ||
    getFellowshipLogsRateLimitStatus(previous, nowMilliseconds).isStale ||
    rateLimitData.pointsSpentThisHour < previous.pointsSpentThisHour
  ) {
    return null;
  }

  return rateLimitData.pointsSpentThisHour - previous.pointsSpentThisHour;
}

export const makeFellowshipLogsGatewayRateLimitDataTracker = E.gen(
  function* () {
    const analytics = yield* FellowshipLogsAnalytics;
    const stateRef = yield* Ref.make<RateLimitTrackerState>(
      makeEmptyTrackerState(null),
    );

    const getState = (connectionIdentity: string | null) => {
      return Ref.get(stateRef).pipe(
        E.map((state) => {
          return getTrackerStateFor(state, connectionIdentity);
        }),
      );
    };

    const updateState = E.fnUntraced(function* (
      rateLimitData: FellowshipLogsRateLimitData,
      costKey: string,
      connectionIdentity: string | null,
    ) {
      const nowMilliseconds = yield* Clock.currentTimeMillis;

      return yield* Ref.modify(stateRef, (current) => {
        const { costByKey, snapshot } = getTrackerStateFor(
          current,
          connectionIdentity,
        );
        const cost = getRequestCost({
          nowMilliseconds,
          previous: snapshot,
          rateLimitData,
        });

        return [
          cost,
          {
            connectionIdentity,
            costByKey:
              cost === null
                ? costByKey
                : {
                    ...costByKey,
                    [costKey]: Math.max(costByKey[costKey] ?? 0, cost),
                  },
            snapshot: {
              ...rateLimitData,
              observedAtMilliseconds: nowMilliseconds,
            },
          },
        ] as const;
      });
    });

    const track: FellowshipLogsGatewayRateLimitDataTracker["track"] =
      E.fnUntraced(function* (
        rateLimitData,
        { connectionIdentity, costKey, operation, wasRefused },
      ) {
        const pointsSpent =
          rateLimitData === undefined
            ? null
            : yield* updateState(rateLimitData, costKey, connectionIdentity);

        yield* analytics.record({ operation, pointsSpent, source: "API" });

        const { costByKey } = yield* getState(connectionIdentity);
        const estimatedCost = wasRefused ? 0 : (costByKey[costKey] ?? 0);

        yield* addFellowshipLogsGatewayRequestCost({
          estimatedPoints: pointsSpent ?? estimatedCost,
          measured: getFellowshipLogsRequestCost(rateLimitData?.currentRequest),
        });
      });

    const getLastKnown: FellowshipLogsGatewayRateLimitDataTracker["getLastKnown"] =
      (connectionIdentity) => {
        return getState(connectionIdentity).pipe(
          E.map(({ snapshot }) => {
            return snapshot;
          }),
        );
      };

    const checkCapacity: FellowshipLogsGatewayRateLimitDataTracker["checkCapacity"] =
      E.fnUntraced(function* (costKey, { connectionIdentity, spending }) {
        const { costByKey, snapshot } = yield* getState(connectionIdentity);

        if (snapshot === null) {
          return;
        }

        const nowMilliseconds = yield* Clock.currentTimeMillis;

        if (spending === "USER_POINTS_ONLY") {
          const failure = getUserPointsOnlyCapacityFailure(
            snapshot,
            nowMilliseconds,
          );

          if (Option.isSome(failure)) {
            return yield* new FellowshipLogsGatewayRateLimitExceededError({
              reason: failure.value.reason,
              resetsAt: DateTime.makeUnsafe(failure.value.resetsAtMilliseconds),
            });
          }

          return;
        }

        const status = getFellowshipLogsRateLimitStatus(
          snapshot,
          nowMilliseconds,
        );
        const estimatedCost = costByKey[costKey] ?? 0;

        if (status.isExhausted || status.pointsRemaining < estimatedCost) {
          return yield* new FellowshipLogsGatewayRateLimitExceededError({
            reason: "PreflightExhausted",
            resetsAt: DateTime.makeUnsafe(status.resetsAtMilliseconds),
          });
        }
      });

    const getRejectedResetsAtMilliseconds = (
      snapshot: FellowshipLogsRateLimitSnapshot | null,
      spending: FellowshipLogsGatewaySpending,
      nowMilliseconds: number,
    ): number | null => {
      if (snapshot === null) {
        return null;
      }

      if (spending === "USER_POINTS_ONLY") {
        const resetsAtMilliseconds = getFellowshipLogsPointPools(
          snapshot,
          nowMilliseconds,
        ).USER.resetsAtMilliseconds;

        return resetsAtMilliseconds !== null &&
          resetsAtMilliseconds > nowMilliseconds
          ? resetsAtMilliseconds
          : null;
      }

      const status = getFellowshipLogsRateLimitStatus(
        snapshot,
        nowMilliseconds,
      );

      return status.isStale ? null : status.resetsAtMilliseconds;
    };

    const getRejectedError: FellowshipLogsGatewayRateLimitDataTracker["getRejectedError"] =
      E.fnUntraced(function* ({ connectionIdentity, spending }) {
        const { snapshot } = yield* getState(connectionIdentity);
        const nowMilliseconds = yield* Clock.currentTimeMillis;
        const holdFailure =
          spending === "USER_POINTS_ONLY" && snapshot !== null
            ? getUserPointsOnlyCapacityFailure(snapshot, nowMilliseconds).pipe(
                Option.filter((failure) => {
                  return failure.reason === "ApplicationHoldUnavailable";
                }),
              )
            : Option.none();

        if (Option.isSome(holdFailure)) {
          return new FellowshipLogsGatewayRateLimitExceededError({
            reason: holdFailure.value.reason,
            resetsAt: DateTime.makeUnsafe(
              holdFailure.value.resetsAtMilliseconds,
            ),
          });
        }

        const resetsAtMilliseconds =
          getRejectedResetsAtMilliseconds(
            snapshot,
            spending,
            nowMilliseconds,
          ) ?? nowMilliseconds + Duration.toMillis(UNKNOWN_RESET_DELAY);

        return new FellowshipLogsGatewayRateLimitExceededError({
          reason:
            spending === "USER_POINTS_ONLY"
              ? "UserPointsRejectedByApi"
              : "RejectedByApi",
          resetsAt: DateTime.makeUnsafe(resetsAtMilliseconds),
        });
      });

    return {
      checkCapacity,
      getLastKnown,
      getRejectedError,
      track,
    } satisfies FellowshipLogsGatewayRateLimitDataTracker;
  },
);

function readAndTrackGraphQLResponse(
  tracker: FellowshipLogsGatewayRateLimitDataTracker,
  getRequestContext: GetFellowshipLogsGatewayRequestContext,
  { costKey, operation, skipCapacityCheck = false }: TrackResponseOptions,
) {
  return function trackResponse<Data extends ResponseDataWithRateLimit>(
    responseEffect: E.Effect<
      FellowshipLogsGatewayGraphQLResponse<Data>,
      FellowshipLogsGatewayQueryError
    >,
  ) {
    return E.gen(function* () {
      const context = yield* getRequestContext();
      const failRejected = tracker
        .getRejectedError(context)
        .pipe(E.flatMap(E.fail));

      if (!skipCapacityCheck) {
        yield* tracker.checkCapacity(costKey, context);
      }

      const response = yield* responseEffect.pipe(
        E.catchTag("FellowshipLogsGatewayRateLimitRejectedError", () => {
          return failRejected;
        }),
      );

      const pointPolicyErrorReason = classifyFellowshipLogsPointPolicyErrors(
        response.errors,
      );
      const isRateLimited =
        response.errors?.some(isRateLimitGraphQLError) === true;

      yield* tracker.track(response.data?.rateLimitData, {
        connectionIdentity: context.connectionIdentity,
        costKey,
        operation,
        wasRefused: Option.isSome(pointPolicyErrorReason) || isRateLimited,
      });

      if (Option.isSome(pointPolicyErrorReason)) {
        return yield* new FellowshipLogsGatewayPointPolicyError({
          reason: pointPolicyErrorReason.value,
        });
      }

      if (isRateLimited) {
        return yield* failRejected;
      }

      return yield* getGraphQLResponseData(response);
    });
  };
}

type TrackedQueryOptions = Omit<TrackResponseOptions, "costKey">;

export type GetFellowshipLogsGatewayRequestContext = () => E.Effect<
  FellowshipLogsGatewayRequestContext,
  Exclude<
    FellowshipLogsGatewayQueryError,
    FellowshipLogsGatewayRateLimitRejectedError
  >
>;

export function makeTrackedQuery(
  query: Query,
  tracker: FellowshipLogsGatewayRateLimitDataTracker,
  getRequestContext: GetFellowshipLogsGatewayRequestContext,
) {
  return function trackedQuery<Data extends ResponseDataWithRateLimit>(
    request: FellowshipLogsGatewayGraphQLRequest,
    responseSchema: Schema.Decoder<Data, never>,
    options: TrackedQueryOptions,
  ) {
    return query(request, responseSchema).pipe(
      readAndTrackGraphQLResponse(tracker, getRequestContext, {
        costKey: request.query.document,
        ...options,
      }),
    );
  };
}

type GetReportOrFailOptions<Report> = {
  readonly report: Report | null;
  readonly reportCode: string;
};

export function getReportOrFail<Report>({
  report,
  reportCode,
}: GetReportOrFailOptions<Report>) {
  return report === null
    ? E.fail(
        new FellowshipLogsGatewayGraphQLResponseError({
          errors: [],
          reason: "ReportNotFound",
          reportCode,
        }),
      )
    : E.succeed(report);
}

type FindFightOrFailOptions<Fight> = {
  readonly fightId: number;
  readonly fights: ReadonlyArray<Fight>;
  readonly reportCode: string;
};

export function findFightOrFail<Fight extends { readonly id: number }>({
  fightId,
  fights,
  reportCode,
}: FindFightOrFailOptions<Fight>) {
  const fight = fights.find((candidate) => {
    return candidate.id === fightId;
  });

  return fight === undefined
    ? E.fail(
        new FellowshipLogsGatewayGraphQLResponseError({
          errors: [],
          fightId,
          reason: "FightNotFound",
          reportCode,
        }),
      )
    : E.succeed(fight);
}

type DungeonRunMetadataFight = {
  readonly difficultyLevel: number | null;
  readonly encounterID: number;
  readonly endTime: number;
  readonly id: number;
  readonly inProgress: boolean;
  readonly startTime: number;
};

type DungeonRunMetadataResponseData = {
  readonly reportData: {
    readonly report: {
      readonly fights: ReadonlyArray<DungeonRunMetadataFight>;
      readonly startTime: number;
    } | null;
  };
};

type DeriveDungeonRunMetadataOptions = {
  readonly fightId: number;
  readonly reportCode: string;
  readonly responseData: DungeonRunMetadataResponseData;
};

export const deriveDungeonRunMetadata = E.fn("deriveDungeonRunMetadata")(
  function* ({
    fightId,
    reportCode,
    responseData,
  }: DeriveDungeonRunMetadataOptions) {
    const report = yield* getReportOrFail({
      report: responseData.reportData.report,
      reportCode,
    });

    const fight = yield* findFightOrFail({
      fightId,
      fights: report.fights,
      reportCode,
    });

    if (fight.difficultyLevel === null) {
      return yield* new FellowshipLogsGatewayGraphQLResponseError({
        errors: [],
        fightId,
        reason: "FightMissingDifficultyLevel",
        reportCode,
      });
    }

    return {
      dungeonId: String(fight.encounterID),
      dungeonLevel: fight.difficultyLevel,
      endedAtMilliseconds: report.startTime + fight.endTime,
      isInProgress: fight.inProgress,
      startedAtMilliseconds: report.startTime + fight.startTime,
    };
  },
);
