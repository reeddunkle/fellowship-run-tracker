import * as A from "effect/Array";
import * as Option from "effect/Option";

import {
  type DungeonRunObservationApi,
  type DungeonRunStateApi,
} from "@frt/api-contract/websocket/dungeon-run/dungeon-run-api-message-schema.ts";
import {
  type DungeonRunApiComparisonGroup,
  type DungeonRunApiHistory,
  type DungeonRunApiObservationStatistics,
} from "@frt/shared/dungeon-run/dungeon-run-api-schema.ts";
import {
  encodeRequirementObservationIdentity,
  encodeRequirementObservationOccurrenceIdentity,
} from "@frt/shared/fellowship/requirements/requirement-observation-identity-schema.ts";

type DungeonRunObservationAnalytics = {
  readonly bestElapsedMilliseconds: number;
  readonly meanElapsedMilliseconds: number;
  readonly medianElapsedMilliseconds: number;
  readonly sampleCount: number;
};

export type DungeonRunObservationInterpretation = {
  readonly analytics: DungeonRunObservationAnalytics | undefined;
  readonly elapsedFromPreviousObservationMilliseconds: number | undefined;
  readonly elapsedFromStartMilliseconds: number | undefined;
  readonly observation: DungeonRunObservationApi;
  readonly occurrence: number;
  readonly previousObservation: DungeonRunObservationApi | undefined;
};

export type DungeonRunInterpretationState = {
  readonly latestObservation: DungeonRunObservationInterpretation | undefined;
  readonly observations: ReadonlyArray<DungeonRunObservationInterpretation>;
};

type CreateDungeonRunInterpretationStateOptions = {
  readonly comparisonGroup: DungeonRunApiComparisonGroup;
  readonly dungeonRun: DungeonRunStateApi["dungeonRun"];
  readonly history: DungeonRunApiHistory | null;
  readonly observations: ReadonlyArray<DungeonRunObservationApi>;
};

function createObservationAnalytics(
  statistics: DungeonRunApiObservationStatistics,
): DungeonRunObservationAnalytics {
  return {
    bestElapsedMilliseconds: statistics.bestElapsedMilliseconds,
    meanElapsedMilliseconds: statistics.meanElapsedMilliseconds,
    medianElapsedMilliseconds: statistics.medianElapsedMilliseconds,
    sampleCount: statistics.sampleCount,
  };
}

export function createDungeonRunInterpretationState({
  comparisonGroup,
  dungeonRun,
  history,
  observations,
}: CreateDungeonRunInterpretationStateOptions): DungeonRunInterpretationState {
  const relevantHistoricalStatistics = A.filter(
    history?.observations ?? [],
    (statistics) => {
      return statistics.comparisonGroup === comparisonGroup;
    },
  );

  const historicalStatisticsByKey = A.reduce(
    relevantHistoricalStatistics,
    new Map<string, DungeonRunApiObservationStatistics>(),
    (accumulator, statistics) => {
      const key = encodeRequirementObservationOccurrenceIdentity([
        statistics.type,
        statistics.targetId,
        statistics.occurrence,
      ]);

      accumulator.set(key, statistics);

      return accumulator;
    },
  );

  const interpretationResult = A.reduce(
    observations,
    {
      observations: [] as Array<DungeonRunObservationInterpretation>,
      occurrencesByIdentity: new Map<string, number>(),
    },
    (accumulator, observation) => {
      const observationIdentityKey = encodeRequirementObservationIdentity([
        observation.type,
        observation.targetId,
      ]);

      const occurrence =
        (accumulator.occurrencesByIdentity.get(observationIdentityKey) ?? 0) +
        1;

      accumulator.occurrencesByIdentity.set(observationIdentityKey, occurrence);

      const previousObservation = A.last(accumulator.observations).pipe(
        Option.getOrUndefined,
      )?.observation;

      const elapsedFromStartMilliseconds =
        dungeonRun?.startedAtMilliseconds === null ||
        dungeonRun?.startedAtMilliseconds === undefined
          ? undefined
          : observation.timestampMilliseconds -
            dungeonRun.startedAtMilliseconds;

      const elapsedFromPreviousObservationMilliseconds =
        previousObservation === undefined
          ? undefined
          : observation.timestampMilliseconds -
            previousObservation.timestampMilliseconds;

      const historicalStatisticsKey =
        encodeRequirementObservationOccurrenceIdentity([
          observation.type,
          observation.targetId,
          occurrence,
        ]);

      const historicalStatistics = historicalStatisticsByKey.get(
        historicalStatisticsKey,
      );

      accumulator.observations.push({
        analytics:
          historicalStatistics === undefined
            ? undefined
            : createObservationAnalytics(historicalStatistics),
        elapsedFromPreviousObservationMilliseconds,
        elapsedFromStartMilliseconds,
        observation,
        occurrence,
        previousObservation,
      });

      return accumulator;
    },
  );

  return {
    latestObservation: A.last(interpretationResult.observations).pipe(
      Option.getOrUndefined,
    ),
    observations: interpretationResult.observations,
  };
}
