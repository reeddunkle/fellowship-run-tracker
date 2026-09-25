import { type FellowshipLogsApiAnalyticsSummary } from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";

const CountFormatter = new Intl.NumberFormat("en-US");

const PercentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  style: "percent",
});

type AnalyticsItem = {
  readonly label: string;
  readonly value: string;
};

export function getAnalyticsItems(
  summary: FellowshipLogsApiAnalyticsSummary,
): ReadonlyArray<AnalyticsItem> {
  return [
    {
      label: "Cache hits",
      value: CountFormatter.format(summary.cacheHitCount),
    },
    {
      label: "Hit rate",
      value:
        summary.cacheHitCount + summary.apiRequestCount === 0
          ? "—"
          : PercentFormatter.format(summary.cacheHitRate),
    },
    {
      label: "Points saved",
      value: `~${CountFormatter.format(summary.estimatedPointsSaved)}`,
    },
    {
      label: "Points spent",
      value: `~${CountFormatter.format(summary.pointsSpent)}`,
    },
  ];
}
