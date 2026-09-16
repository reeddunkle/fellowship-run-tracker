import { millisecondsToMinutes } from "date-fns/millisecondsToMinutes";
import { millisecondsToSeconds } from "date-fns/millisecondsToSeconds";
import * as A from "effect/Array";
import { pipe } from "effect/Function";

import { type DungeonRunObservationInterpretation } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-interpretation.ts";

export type DungeonRunHistoricalComparison = "AVERAGE" | "BEST" | "MEDIAN";

type RequirementRow = {
  readonly completedObservation:
    | DungeonRunObservationInterpretation
    | undefined;
};

export function getObservationComparisonElapsedMilliseconds({
  comparison,
  observation,
}: {
  readonly comparison: DungeonRunHistoricalComparison;
  readonly observation: DungeonRunObservationInterpretation;
}): number | undefined {
  if (observation.analytics === undefined) {
    return undefined;
  }

  const comparisonToAnalytics: Record<DungeonRunHistoricalComparison, number> =
    {
      AVERAGE: observation.analytics.meanElapsedMilliseconds,
      BEST: observation.analytics.bestElapsedMilliseconds,
      MEDIAN: observation.analytics.medianElapsedMilliseconds,
    };

  return comparisonToAnalytics[comparison];
}

export function getComparisonElapsedMilliseconds({
  comparison,
  requirements,
}: {
  readonly comparison: DungeonRunHistoricalComparison;
  readonly requirements: ReadonlyArray<RequirementRow>;
}): number | undefined {
  const comparisonTimes = pipe(
    requirements,
    A.map((requirement) => {
      if (requirement.completedObservation === undefined) {
        return undefined;
      }

      return getObservationComparisonElapsedMilliseconds({
        comparison,
        observation: requirement.completedObservation,
      });
    }),
    A.filter((value): value is number => {
      return value !== undefined;
    }),
  );

  if (
    comparisonTimes.length === 0 ||
    comparisonTimes.length !== requirements.length
  ) {
    return undefined;
  }

  return Math.max(...comparisonTimes);
}

type FormatMillisecondsOptions = {
  readonly fractionalDigits?: 0 | 1 | 2 | 3;
  readonly includeSign?: boolean;
  readonly includeZeroMinutes?: boolean;
  readonly minimumFractionalDigits?: 0 | 1 | 2 | 3;
  readonly padMinutes?: boolean;
  readonly padSeconds?: boolean;
};

function formatMilliseconds(
  milliseconds: number,
  {
    fractionalDigits = 3,
    includeSign = false,
    includeZeroMinutes = true,
    minimumFractionalDigits = fractionalDigits,
    padMinutes = false,
    padSeconds = true,
  }: FormatMillisecondsOptions = {},
): string {
  const fractionalDivisor = 10 ** (3 - fractionalDigits);

  const absoluteMilliseconds =
    Math.round(Math.abs(milliseconds) / fractionalDivisor) * fractionalDivisor;

  const minutes = millisecondsToMinutes(absoluteMilliseconds);
  const seconds = millisecondsToSeconds(absoluteMilliseconds) % 60;
  const fractionalMilliseconds = absoluteMilliseconds % 1_000;

  const sign =
    includeSign && milliseconds !== 0 ? (milliseconds < 0 ? "-" : "+") : "";

  const formattedSeconds = padSeconds
    ? String(seconds).padStart(2, "0")
    : String(seconds);

  const fractionalValue = String(fractionalMilliseconds)
    .padStart(3, "0")
    .slice(0, fractionalDigits);

  const trimmedFractionalValue = fractionalValue.replace(/0+$/, "");

  const formattedFractionalValue = fractionalValue.slice(
    0,
    Math.max(trimmedFractionalValue.length, minimumFractionalDigits),
  );

  const fractionalPart =
    formattedFractionalValue === "" ? "" : `.${formattedFractionalValue}`;

  if (minutes === 0 && !includeZeroMinutes) {
    return `${sign}${formattedSeconds}${fractionalPart}`;
  }

  const formattedMinutes = padMinutes
    ? String(minutes).padStart(2, "0")
    : String(minutes);

  return `${sign}${formattedMinutes}:${formattedSeconds}${fractionalPart}`;
}

export function formatDuration(
  milliseconds: number | undefined,
  options?: FormatMillisecondsOptions,
): string {
  if (milliseconds === undefined) {
    return "—";
  }

  return formatMilliseconds(milliseconds, options);
}

export function formatSignedDuration(
  milliseconds: number | undefined,
  options?: FormatMillisecondsOptions,
): string {
  if (milliseconds === undefined) {
    return "—";
  }

  return formatMilliseconds(milliseconds, {
    includeSign: true,
    ...options,
  });
}
