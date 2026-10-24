import { type FellowshipLogsPointPool } from "@frt/shared/fellowship-logs/fellowship-logs-beta-point-policy.ts";
import { type FellowshipLogsRateLimitSnapshot } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";

type FellowshipLogsPointPoolResetSource = "pointsResetIn" | "userPointsResetIn";

type FellowshipLogsPointPoolStatus = {
  readonly hasRemainingPoints: boolean | null;
  readonly limitPerHour: number | null;
  readonly pointsRemaining: number | null;
  readonly pool: FellowshipLogsPointPool;
  readonly resetSource: FellowshipLogsPointPoolResetSource | null;
  readonly resetsAtMilliseconds: number | null;
};

export type FellowshipLogsPointPools = Record<
  FellowshipLogsPointPool,
  FellowshipLogsPointPoolStatus
>;

function getResetsAt(
  snapshot: FellowshipLogsRateLimitSnapshot,
  resetInSeconds: number | null | undefined,
) {
  return resetInSeconds === null || resetInSeconds === undefined
    ? null
    : snapshot.observedAtMilliseconds + resetInSeconds * 1_000;
}

function getMeteredPool({
  limitPerHour,
  nowMilliseconds,
  pointsSpentThisHour,
  pool,
  resetsAtMilliseconds,
}: {
  readonly limitPerHour: number | undefined;
  readonly nowMilliseconds: number;
  readonly pointsSpentThisHour: number | undefined;
  readonly pool: FellowshipLogsPointPool;
  readonly resetsAtMilliseconds: number;
}): FellowshipLogsPointPoolStatus {
  if (limitPerHour === undefined || pointsSpentThisHour === undefined) {
    return {
      hasRemainingPoints: null,
      limitPerHour: null,
      pointsRemaining: null,
      pool,
      resetSource: null,
      resetsAtMilliseconds: null,
    };
  }

  const pointsRemaining =
    nowMilliseconds >= resetsAtMilliseconds
      ? limitPerHour
      : Math.max(limitPerHour - pointsSpentThisHour, 0);

  return {
    hasRemainingPoints: pointsRemaining > 0,
    limitPerHour,
    pointsRemaining,
    pool,
    resetSource: "pointsResetIn",
    resetsAtMilliseconds,
  };
}

function getUserPool(
  snapshot: FellowshipLogsRateLimitSnapshot,
  nowMilliseconds: number,
): FellowshipLogsPointPoolStatus {
  const resetsAtMilliseconds = getResetsAt(
    snapshot,
    snapshot.userPointsResetIn,
  );
  const hasReset =
    resetsAtMilliseconds !== null && nowMilliseconds >= resetsAtMilliseconds;
  const reported = snapshot.userHasRemainingPoints ?? null;

  return {
    hasRemainingPoints: reported === false && hasReset ? null : reported,
    limitPerHour: null,
    pointsRemaining: null,
    pool: "USER",
    resetSource: resetsAtMilliseconds === null ? null : "userPointsResetIn",
    resetsAtMilliseconds,
  };
}

export function getFellowshipLogsPointPools(
  snapshot: FellowshipLogsRateLimitSnapshot,
  nowMilliseconds: number,
): FellowshipLogsPointPools {
  const applicationResetsAt =
    snapshot.observedAtMilliseconds + snapshot.pointsResetIn * 1_000;

  return {
    APPLICATION: getMeteredPool({
      limitPerHour: snapshot.limitPerHour,
      nowMilliseconds,
      pointsSpentThisHour: snapshot.pointsSpentThisHour,
      pool: "APPLICATION",
      resetsAtMilliseconds: applicationResetsAt,
    }),
    DATABASE: getMeteredPool({
      limitPerHour: snapshot.databaseLimitPerHour,
      nowMilliseconds,
      pointsSpentThisHour: snapshot.databasePointsSpentThisHour,
      pool: "DATABASE",
      resetsAtMilliseconds: applicationResetsAt,
    }),
    USER: getUserPool(snapshot, nowMilliseconds),
  };
}
