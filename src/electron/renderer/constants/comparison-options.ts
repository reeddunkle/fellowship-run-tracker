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
    label: "Last run",
    value: "LAST_RUN",
  },
  {
    label: "Goal",
    value: "CUSTOM",
  },
] as const;

export type DungeonRunComparison = (typeof COMPARISON_OPTIONS)[number]["value"];
