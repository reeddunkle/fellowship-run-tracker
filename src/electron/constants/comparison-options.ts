import * as R from "effect/Record";

export const COMPARISON_OPTIONS = [
  {
    label: "Best",
    value: "BEST",
  },
  {
    label: "Average",
    value: "AVERAGE",
  },
  {
    label: "Median",
    value: "MEDIAN",
  },
  {
    label: "Goal",
    value: "CUSTOM",
  },
] as const;

export type DungeonRunComparison = (typeof COMPARISON_OPTIONS)[number]["value"];

type ComparisonOption = (typeof COMPARISON_OPTIONS)[number];

export const comparisonByValue: Record<DungeonRunComparison, ComparisonOption> =
  R.fromIterableBy(
    COMPARISON_OPTIONS,
    (comparison: ComparisonOption) => comparison.value,
  );
