import * as Schema from "effect/Schema";

import { FellowshipLogsApiRateLimitExceededError } from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { type FellowshipLogsPointPool } from "@frt/shared/fellowship-logs/fellowship-logs-beta-point-policy.ts";
import {
  type FellowshipLogsApiImportCostEstimate,
  type FellowshipLogsApiPointPools,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";
import { type FellowshipLogsConnectionProfile } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import { MIN_RANGE_SAMPLE_COUNT } from "@frt/shared/fellowship-logs/get-fellowship-logs-import-cost-estimate.ts";

import {
  formatLocalTimeFromMilliseconds,
  formatMinutesUntil,
} from "@/util/format-date-time.ts";

type PointPoolsSnapshot = NonNullable<FellowshipLogsApiPointPools>;

type PointPoolStatus = PointPoolsSnapshot["pools"][FellowshipLogsPointPool];

const PointsFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function formatPoints(points: number): string {
  return PointsFormatter.format(points);
}

export function formatResetTime(
  resetsAtMilliseconds: number,
  nowMilliseconds: number,
): string {
  return `${formatMinutesUntil(resetsAtMilliseconds, nowMilliseconds)}, at ${formatLocalTimeFromMilliseconds(resetsAtMilliseconds)}`;
}

const RATE_LIMIT_EXCEEDED_SUMMARIES = {
  APPLICATION_POINTS_EXHAUSTED: "You're out of API client points.",
  SHARED_APPLICATION_CAPACITY_UNAVAILABLE:
    "Fellowship Logs is temporarily limiting this connection.",
  USER_POINTS_EXHAUSTED: "You're out of your account points.",
} as const satisfies Record<
  FellowshipLogsApiRateLimitExceededError["reason"],
  string
>;

const isRateLimitExceededError = Schema.is(
  FellowshipLogsApiRateLimitExceededError,
);

export function getRateLimitExceededMessage(
  error: unknown,
  nowMilliseconds: number,
): string | undefined {
  if (!isRateLimitExceededError(error)) {
    return undefined;
  }

  return `${RATE_LIMIT_EXCEEDED_SUMMARIES[error.reason]} Points reset in ${formatResetTime(error.resetsAtMilliseconds, nowMilliseconds)}.`;
}

type PointPoolRole = {
  readonly label: string;
  readonly note: string | null;
  readonly pool: FellowshipLogsPointPool;
};

const POINT_POOL_ROLES = {
  FELLOWSHIP_RUN_TRACKER_USER: [
    { label: "Your account points", note: "Imports use these", pool: "USER" },
  ],
  NONE: [
    { label: "Your account points", note: null, pool: "USER" },
    { label: "API client points", note: null, pool: "APPLICATION" },
  ],
  OWN_CLIENT: [
    {
      label: "API client points",
      note: "Imports use these",
      pool: "APPLICATION",
    },
  ],
  OWN_CLIENT_USER: [
    {
      label: "Your account points",
      note: "Imports use these first",
      pool: "USER",
    },
    {
      label: "API client points",
      note: "Used when your account points run out",
      pool: "APPLICATION",
    },
  ],
} as const satisfies Record<
  FellowshipLogsConnectionProfile | "NONE",
  ReadonlyArray<PointPoolRole>
>;

function hasReset(pool: PointPoolStatus, nowMilliseconds: number): boolean {
  return (
    pool.resetsAtMilliseconds !== null &&
    pool.resetsAtMilliseconds <= nowMilliseconds
  );
}

function isExhausted(pool: PointPoolStatus, nowMilliseconds: number): boolean {
  if (hasReset(pool, nowMilliseconds)) {
    return false;
  }

  return (
    pool.hasRemainingPoints === false ||
    (pool.pointsRemaining !== null && pool.pointsRemaining < 1)
  );
}

function getPoolValue(pool: PointPoolStatus, nowMilliseconds: number): string {
  const isReset = hasReset(pool, nowMilliseconds);

  if (pool.limitPerHour !== null && pool.pointsRemaining !== null) {
    const pointsRemaining = isReset
      ? pool.limitPerHour
      : Math.floor(pool.pointsRemaining);

    return `${formatPoints(pointsRemaining)} of ${formatPoints(pool.limitPerHour)} left`;
  }

  if (pool.hasRemainingPoints === null) {
    return "Not reported yet";
  }

  return pool.hasRemainingPoints || isReset ? "Available" : "Used up";
}

export type PointPoolItem = {
  readonly isWarning: boolean;
  readonly label: string;
  readonly note: string | null;
  readonly pool: FellowshipLogsPointPool;
  readonly resets: string | null;
  readonly value: string;
};

export function getPointPoolItems(
  pointPools: PointPoolsSnapshot,
  profile: FellowshipLogsConnectionProfile | null,
  nowMilliseconds: number,
): ReadonlyArray<PointPoolItem> {
  return POINT_POOL_ROLES[profile ?? "NONE"].map(({ label, note, pool }) => {
    const status = pointPools.pools[pool];
    const resets =
      status.resetsAtMilliseconds === null || hasReset(status, nowMilliseconds)
        ? null
        : `Resets in ${formatResetTime(status.resetsAtMilliseconds, nowMilliseconds)}`;

    return {
      isWarning: isExhausted(status, nowMilliseconds),
      label,
      note,
      pool,
      resets,
      value: getPoolValue(status, nowMilliseconds),
    };
  });
}

type BlockingCondition = {
  readonly pools: ReadonlyArray<FellowshipLogsPointPool>;
  readonly summary: string;
};

const BLOCKING_CONDITIONS = {
  FELLOWSHIP_RUN_TRACKER_USER: [
    {
      pools: ["USER"],
      summary: RATE_LIMIT_EXCEEDED_SUMMARIES.USER_POINTS_EXHAUSTED,
    },
    {
      pools: ["APPLICATION"],
      summary:
        RATE_LIMIT_EXCEEDED_SUMMARIES.SHARED_APPLICATION_CAPACITY_UNAVAILABLE,
    },
  ],
  OWN_CLIENT: [
    {
      pools: ["APPLICATION"],
      summary: "Your API client is out of points.",
    },
  ],
  OWN_CLIENT_USER: [
    {
      pools: ["USER", "APPLICATION"],
      summary: "Your account and API client are out of points.",
    },
  ],
} as const satisfies Record<
  FellowshipLogsConnectionProfile,
  ReadonlyArray<BlockingCondition>
>;

export type PointPoolsBlock = {
  readonly lookupMessage: string;
  readonly queueNotice: string;
};

export function getPointPoolsBlock(
  pointPools: FellowshipLogsApiPointPools | undefined,
  profile: FellowshipLogsConnectionProfile | undefined,
  nowMilliseconds: number,
): PointPoolsBlock | undefined {
  if (
    pointPools === null ||
    pointPools === undefined ||
    profile === undefined
  ) {
    return undefined;
  }

  const condition = BLOCKING_CONDITIONS[profile].find(({ pools }) => {
    return pools.every((pool) => {
      return isExhausted(pointPools.pools[pool], nowMilliseconds);
    });
  });

  if (condition === undefined) {
    return undefined;
  }

  const resetsAtMilliseconds = condition.pools
    .map((pool) => {
      return pointPools.pools[pool].resetsAtMilliseconds;
    })
    .filter((resetsAt) => {
      return resetsAt !== null;
    })
    .reduce<number | null>((earliest, resetsAt) => {
      return earliest === null ? resetsAt : Math.min(earliest, resetsAt);
    }, null);

  if (resetsAtMilliseconds === null) {
    return {
      lookupMessage: `${condition.summary} Try again once points free up.`,
      queueNotice: `${condition.summary} This import will start once points free up.`,
    };
  }

  const resetTime = formatResetTime(resetsAtMilliseconds, nowMilliseconds);

  return {
    lookupMessage: `${condition.summary} Points reset in ${resetTime}.`,
    queueNotice: `${condition.summary} This import will start when points reset in ${resetTime}.`,
  };
}

export type ImportCostEstimateLines = {
  readonly latest: string;
  readonly range: string | null;
};

function getLatestImportCostLine(
  latest: NonNullable<FellowshipLogsApiImportCostEstimate>["latest"],
): string {
  if (latest === null) {
    return "Your first import will show its exact cost here.";
  }

  if (latest.isFullyCached) {
    return "Your last import used no points because its report was already cached.";
  }

  const total = `Your last import cost ${formatPoints(latest.totalPoints)} points, including the lookup.`;

  return latest.userPoints > 0 && latest.applicationPoints > 0
    ? `${total} That was ${formatPoints(latest.userPoints)} account points and ${formatPoints(latest.applicationPoints)} API client points.`
    : total;
}

export function getImportCostEstimateLines(
  estimate: FellowshipLogsApiImportCostEstimate,
): ImportCostEstimateLines {
  if (estimate === null) {
    return {
      latest: "Connect to Fellowship Logs to see what your imports cost.",
      range: null,
    };
  }

  return {
    latest: getLatestImportCostLine(estimate.latest),
    range:
      estimate.range === null
        ? `A personal range appears after ${MIN_RANGE_SAMPLE_COUNT} comparable imports.`
        : `Imports like yours usually cost ${formatPoints(estimate.range.lowPoints)}–${formatPoints(estimate.range.highPoints)} points, based on ${formatPoints(estimate.range.sampleCount)} of your imports.`,
  };
}
