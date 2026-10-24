import { type FellowshipLogsConnectionProfile } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import { type FellowshipLogsImportCostObservation } from "@frt/shared/fellowship-logs/fellowship-logs-import-cost-schema.ts";

export const MIN_RANGE_SAMPLE_COUNT = 10;

const RANGE_LOW_PERCENTILE = 0.1;

const RANGE_HIGH_PERCENTILE = 0.9;

type FellowshipLogsImportCost = {
  readonly applicationPoints: number;
  readonly completedAtMilliseconds: number;
  readonly isFullyCached: boolean;
  readonly totalPoints: number;
  readonly userPoints: number;
};

type FellowshipLogsImportCostRange = {
  readonly highPoints: number;
  readonly lowPoints: number;
  readonly sampleCount: number;
};

export type FellowshipLogsImportCostEstimate = {
  readonly latest: FellowshipLogsImportCost | null;
  readonly range: FellowshipLogsImportCostRange | null;
};

type GetFellowshipLogsImportCostEstimateOptions = {
  readonly includesLookup: boolean;
  readonly pointPolicyVersion: string;
  readonly profile: FellowshipLogsConnectionProfile;
};

function isExactCompletedImport(
  observation: FellowshipLogsImportCostObservation,
  { pointPolicyVersion, profile }: GetFellowshipLogsImportCostEstimateOptions,
) {
  return (
    observation.outcome === "SUCCEEDED" &&
    !observation.followsProfileChange &&
    !observation.isResumed &&
    observation.profile === profile &&
    observation.pointPolicyVersion === pointPolicyVersion &&
    observation.unmeasuredRequestCount === 0 &&
    observation.apiRequestCount + observation.cacheHitCount > 0
  );
}

function isComparableSample(
  observation: FellowshipLogsImportCostObservation,
  options: GetFellowshipLogsImportCostEstimateOptions,
) {
  return (
    isExactCompletedImport(observation, options) &&
    observation.cacheHitCount === 0 &&
    observation.apiRequestCount > 0 &&
    observation.includesLookup === options.includesLookup
  );
}

function getNearestRank(
  sortedPoints: ReadonlyArray<number>,
  percentile: number,
) {
  const index = Math.min(
    Math.max(Math.ceil(percentile * sortedPoints.length) - 1, 0),
    sortedPoints.length - 1,
  );

  return sortedPoints[index] ?? 0;
}

function getRange(
  samples: ReadonlyArray<FellowshipLogsImportCostObservation>,
): FellowshipLogsImportCostRange | null {
  if (samples.length < MIN_RANGE_SAMPLE_COUNT) {
    return null;
  }

  const sortedPoints = samples
    .map((sample) => {
      return sample.totalPoints;
    })
    .toSorted((first, second) => {
      return first - second;
    });

  return {
    highPoints: getNearestRank(sortedPoints, RANGE_HIGH_PERCENTILE),
    lowPoints: getNearestRank(sortedPoints, RANGE_LOW_PERCENTILE),
    sampleCount: samples.length,
  };
}

export function getFellowshipLogsImportCostEstimate(
  observations: ReadonlyArray<FellowshipLogsImportCostObservation>,
  options: GetFellowshipLogsImportCostEstimateOptions,
): FellowshipLogsImportCostEstimate {
  const latest = observations
    .filter((observation) => {
      return isExactCompletedImport(observation, options);
    })
    .reduce<FellowshipLogsImportCostObservation | null>(
      (newest, observation) => {
        return newest === null ||
          observation.completedAtMilliseconds > newest.completedAtMilliseconds
          ? observation
          : newest;
      },
      null,
    );

  return {
    latest:
      latest === null
        ? null
        : {
            applicationPoints: latest.applicationPoints,
            completedAtMilliseconds: latest.completedAtMilliseconds,
            isFullyCached: latest.apiRequestCount === 0,
            totalPoints: latest.totalPoints,
            userPoints: latest.userPoints,
          },
    range: getRange(
      observations.filter((observation) => {
        return isComparableSample(observation, options);
      }),
    ),
  };
}
