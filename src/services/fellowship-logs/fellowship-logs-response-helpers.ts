import * as E from "effect/Effect";
import * as Ref from "effect/Ref";
import type * as Schema from "effect/Schema";

import {
  FellowshipLogsGraphQLResponseError,
  type FellowshipLogsRequestError,
} from "@/errors/fellowship-logs-error.ts";
import { type Query } from "@/services/fellowship-logs/fellowship-logs-service.ts";
import {
  type FellowshipLogsGraphQLRequest,
  type FellowshipLogsGraphQLResponse,
} from "@/services/fellowship-logs/validation/fellowship-logs-graphql-schema.ts";
import { type FellowshipLogsRateLimitData } from "@/services/fellowship-logs/validation/fellowship-logs-rate-limit-schema.ts";

export function getGraphQLResponseData<Data>(
  response: FellowshipLogsGraphQLResponse<Data>,
) {
  return E.gen(function* () {
    if (response.errors !== undefined && response.errors.length > 0) {
      return yield* new FellowshipLogsGraphQLResponseError({
        errors: response.errors,
        message: "Fellowship Logs returned GraphQL errors.",
      });
    }

    if (response.data === undefined || response.data === null) {
      return yield* new FellowshipLogsGraphQLResponseError({
        errors: response.errors ?? [],
        message: "Fellowship Logs returned no GraphQL data.",
      });
    }

    return response.data;
  });
}

type ResponseDataWithRateLimit = {
  readonly rateLimitData?: FellowshipLogsRateLimitData;
};

type FellowshipLogsRateLimitDataTracker = {
  readonly getLastKnown: () => E.Effect<FellowshipLogsRateLimitData | null>;
  readonly track: (
    rateLimitData: FellowshipLogsRateLimitData | undefined,
  ) => E.Effect<void>;
};

export function makeFellowshipLogsRateLimitDataTracker() {
  return E.gen(function* () {
    const rateLimitDataRef =
      yield* Ref.make<FellowshipLogsRateLimitData | null>(null);

    const track: FellowshipLogsRateLimitDataTracker["track"] = (
      rateLimitData,
    ) => {
      return rateLimitData === undefined
        ? E.void
        : Ref.set(rateLimitDataRef, rateLimitData);
    };

    const getLastKnown: FellowshipLogsRateLimitDataTracker["getLastKnown"] =
      () => {
        return Ref.get(rateLimitDataRef);
      };

    return { getLastKnown, track } satisfies FellowshipLogsRateLimitDataTracker;
  });
}

export function readAndTrackGraphQLResponse(
  tracker: FellowshipLogsRateLimitDataTracker,
) {
  return function trackResponse<Data extends ResponseDataWithRateLimit>(
    responseEffect: E.Effect<
      FellowshipLogsGraphQLResponse<Data>,
      FellowshipLogsRequestError
    >,
  ) {
    return responseEffect.pipe(
      E.flatMap(getGraphQLResponseData),
      E.tap((responseData) => {
        return tracker.track(responseData.rateLimitData);
      }),
    );
  };
}

export function makeTrackedQuery(
  query: Query,
  tracker: FellowshipLogsRateLimitDataTracker,
) {
  return function trackedQuery<Data extends ResponseDataWithRateLimit>(
    request: FellowshipLogsGraphQLRequest,
    responseSchema: Schema.Decoder<Data, never>,
  ) {
    return query(request, responseSchema).pipe(
      readAndTrackGraphQLResponse(tracker),
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
          message: `Fellowship Logs report "${reportCode}" was not found.`,
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
          message: `Fellowship Logs fight ${fightId} was not found in report "${reportCode}".`,
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
        message: `Fellowship Logs fight ${fightId} in report "${reportCode}" does not have a dungeon difficulty level.`,
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
