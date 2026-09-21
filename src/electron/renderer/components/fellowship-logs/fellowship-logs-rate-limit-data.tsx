import { type FellowshipLogsApiRateLimitData } from "@/contracts/fellowship-logs/fellowship-logs-api-schema.ts";
import { cn } from "@/util/class-names.ts";

type FellowshipLogsRateLimitDataProps = {
  readonly className?: string | undefined;
  readonly rateLimitData: FellowshipLogsApiRateLimitData;
};

export function FellowshipLogsRateLimitData({
  className,
  rateLimitData,
}: FellowshipLogsRateLimitDataProps) {
  const data = [
    {
      label: "Hourly limit",
      value: rateLimitData.limitPerHour,
    },
    {
      label: "Points used",
      value: rateLimitData.pointsSpentThisHour,
    },
    {
      label: "Reset in",
      value: rateLimitData.pointsResetIn,
    },
  ] as const;

  return (
    <dl className={cn("grid grid-cols-3 gap-4 text-sm", className)}>
      {data.map(({ label, value }) => {
        return (
          <div key={value}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
