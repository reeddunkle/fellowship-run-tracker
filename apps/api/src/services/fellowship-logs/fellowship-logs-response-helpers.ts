import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Ref from "effect/Ref";
import type * as Schema from "effect/Schema";

import {
  FellowshipLogsGraphQLResponseError,
  FellowshipLogsRateLimitExceededError,
  type FellowshipLogsRateLimitRejectedError,
  type FellowshipLogsRequestError,
} from "@frt/api/errors/fellowship-logs-error.ts";
import { type Query } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import {
  type FellowshipLogsGraphQLError,
  type FellowshipLogsGraphQLRequest,
  type FellowshipLogsGraphQLResponse,
} from "@frt/api/services/fellowship-logs/validation/fellowship-logs-graphql-schema.ts";
import { getFellowshipLogsRateLimitStatus } from "@frt/shared/fellowship-logs/get-fellowship-logs-rate-limit-status.ts";
import {
  type FellowshipLogsRateLimitData,
  type FellowshipLogsRateLimitSnapshot,
} from "@frt/shared/fellowship-logs/validation/fellowship-logs-rate-limit-schema.ts";

export function getGraphQLResponseData<Data>(
  response: FellowshipLogsGraphQLResponse<Data>,
) {
  return E.gen(function* () {
    if (response.errors !== undefined && response.errors.length > 0) {
      return yield* new FellowshipLogsGraphQLResponseError({
        errors: response.errors,
        reason: "ErrorsReturned",
      });
    }

    if (response.data === undefined || response.data === null) {
      return yield* new FellowshipLogsGraphQLResponseError({
        errors: response.errors ?? [],
        reason: "MissingData",
      });
    }

    return response.data;
  });
}

type ResponseDataWithRateLimit = {
  readonly rateLimitData?: FellowshipLogsRateLimitData;
};

// Used when Fellowship Logs rejects a request and there's no current snapshot
// to say when the points reset.
const UNKNOWN_RESET_DELAY = Duration.minutes(5);

type TrackResponseOptions = {
  /**
   * Identifies the kind of request, so its point cost can be learned and
   * checked before sending it again.
   */
  readonly costKey: string;
  /** Skip the pre-flight check. Defaults to `false`. */
  readonly skipCapacityCheck?: boolean;
};

type FellowshipLogsRateLimitDataTracker = {
  /**
   * Fails when the last snapshot shows too few points left for a request of
   * this kind, so it isn't sent only to be rejected.
   */
  readonly checkCapacity: (
    costKey: string,
  ) => E.Effect<void, FellowshipLogsRateLimitExceededError>;
  readonly getLastKnown: () => E.Effect<FellowshipLogsRateLimitSnapshot | null>;
  /** When points are expected back after Fellowship Logs rejects a request. */
  readonly getRejectedResetsAt: () => E.Effect<DateTime.Utc>;
  readonly track: (
    rateLimitData: FellowshipLogsRateLimitData | undefined,
    costKey: string,
  ) => E.Effect<void>;
};

type RateLimitTrackerState = {
  /** Largest cost seen for each kind of request this session. */
  readonly costByKey: Readonly<Record<string, number>>;
  readonly snapshot: FellowshipLogsRateLimitSnapshot | null;
};

function isRateLimitGraphQLError(error: FellowshipLogsGraphQLError) {
  return /rate.?limit/i.test(error.message);
}

/**
 * How much of a fight has been fetched once a report page ends at
 * `nextPageTimestamp` (`null` means it was the last page), from 0 to 1.
 */
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

/**
 * How many points a request cost, from the snapshots before and after it.
 * Unknown (`null`) when the window reset in between.
 */
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

export function makeFellowshipLogsRateLimitDataTracker() {
  return E.gen(function* () {
    const stateRef = yield* Ref.make<RateLimitTrackerState>({
      costByKey: {},
      snapshot: null,
    });

    const track: FellowshipLogsRateLimitDataTracker["track"] = (
      rateLimitData,
      costKey,
    ) => {
      if (rateLimitData === undefined) {
        return E.void;
      }

      return E.gen(function* () {
        const nowMilliseconds = yield* Clock.currentTimeMillis;

        yield* Ref.update(stateRef, ({ costByKey, snapshot }) => {
          const cost = getRequestCost({
            nowMilliseconds,
            previous: snapshot,
            rateLimitData,
          });

          return {
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
          };
        });
      });
    };

    const getLastKnown: FellowshipLogsRateLimitDataTracker["getLastKnown"] =
      () => {
        return Ref.get(stateRef).pipe(
          E.map(({ snapshot }) => {
            return snapshot;
          }),
        );
      };

    const checkCapacity: FellowshipLogsRateLimitDataTracker["checkCapacity"] =
      E.fn("FellowshipLogs.checkCapacity")(function* (costKey) {
        const { costByKey, snapshot } = yield* Ref.get(stateRef);

        if (snapshot === null) {
          return;
        }

        const nowMilliseconds = yield* Clock.currentTimeMillis;
        const status = getFellowshipLogsRateLimitStatus(
          snapshot,
          nowMilliseconds,
        );
        const estimatedCost = costByKey[costKey] ?? 0;

        if (status.isExhausted || status.pointsRemaining < estimatedCost) {
          return yield* new FellowshipLogsRateLimitExceededError({
            reason: "PreflightExhausted",
            resetsAt: DateTime.makeUnsafe(status.resetsAtMilliseconds),
          });
        }
      });

    const getRejectedResetsAt: FellowshipLogsRateLimitDataTracker["getRejectedResetsAt"] =
      E.fn("FellowshipLogs.getRejectedResetsAt")(function* () {
        const { snapshot } = yield* Ref.get(stateRef);
        const nowMilliseconds = yield* Clock.currentTimeMillis;

        if (snapshot !== null) {
          const status = getFellowshipLogsRateLimitStatus(
            snapshot,
            nowMilliseconds,
          );

          if (!status.isStale) {
            return DateTime.makeUnsafe(status.resetsAtMilliseconds);
          }
        }

        return DateTime.makeUnsafe(
          nowMilliseconds + Duration.toMillis(UNKNOWN_RESET_DELAY),
        );
      });

    return {
      checkCapacity,
      getLastKnown,
      getRejectedResetsAt,
      track,
    } satisfies FellowshipLogsRateLimitDataTracker;
  });
}

/**
 * Sends a request through the rate-limit tracker: checks there are points
 * for it first, records the rate-limit data it returns (even alongside
 * GraphQL errors), and turns a rejection into
 * `FellowshipLogsRateLimitExceededError` with the expected reset time.
 */
export function readAndTrackGraphQLResponse(
  tracker: FellowshipLogsRateLimitDataTracker,
  { costKey, skipCapacityCheck = false }: TrackResponseOptions,
) {
  return function trackResponse<Data extends ResponseDataWithRateLimit>(
    responseEffect: E.Effect<
      FellowshipLogsGraphQLResponse<Data>,
      FellowshipLogsRequestError | FellowshipLogsRateLimitRejectedError
    >,
  ) {
    const failRejected = tracker.getRejectedResetsAt().pipe(
      E.flatMap((resetsAt) => {
        return E.fail(
          new FellowshipLogsRateLimitExceededError({
            reason: "RejectedByApi",
            resetsAt,
          }),
        );
      }),
    );

    return E.gen(function* () {
      if (!skipCapacityCheck) {
        yield* tracker.checkCapacity(costKey);
      }

      const response = yield* responseEffect.pipe(
        E.catchTag("FellowshipLogsRateLimitRejectedError", () => {
          return failRejected;
        }),
      );

      yield* tracker.track(response.data?.rateLimitData, costKey);

      if (response.errors?.some(isRateLimitGraphQLError) === true) {
        return yield* failRejected;
      }

      return yield* getGraphQLResponseData(response);
    });
  };
}

type TrackedQueryOptions = Pick<TrackResponseOptions, "skipCapacityCheck">;

export function makeTrackedQuery(
  query: Query,
  tracker: FellowshipLogsRateLimitDataTracker,
) {
  return function trackedQuery<Data extends ResponseDataWithRateLimit>(
    request: FellowshipLogsGraphQLRequest,
    responseSchema: Schema.Decoder<Data, never>,
    options?: TrackedQueryOptions,
  ) {
    return query(request, responseSchema).pipe(
      readAndTrackGraphQLResponse(tracker, {
        // Each query document is one kind of request.
        costKey: request.query,
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
        new FellowshipLogsGraphQLResponseError({
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
        new FellowshipLogsGraphQLResponseError({
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

export function deriveDungeonRunMetadata({
  fightId,
  reportCode,
  responseData,
}: DeriveDungeonRunMetadataOptions) {
  return E.gen(function* () {
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
      return yield* new FellowshipLogsGraphQLResponseError({
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
      startedAtMilliseconds: report.startTime + fight.startTime,
    };
  });
}
