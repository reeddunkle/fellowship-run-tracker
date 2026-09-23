import { type FellowshipLogsApiRateLimitData } from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";
import { getFellowshipLogsRateLimitStatus } from "@frt/shared/fellowship-logs/get-fellowship-logs-rate-limit-status.ts";
import { cn } from "@frt/ui/class-names.ts";

import { getRateLimitDataItems } from "@/renderer/api/fellowship-logs/fellowship-logs-rate-limit-messages.ts";
import { useNowMilliseconds } from "@/renderer/api/fellowship-logs/use-fellowship-logs-rate-limit-status.ts";

type FellowshipLogsRateLimitDataProps = {
  readonly className?: string | undefined;
  readonly rateLimitData: FellowshipLogsApiRateLimitData;
};

export function FellowshipLogsRateLimitData({
  className,
  rateLimitData,
}: FellowshipLogsRateLimitDataProps) {
  const nowMilliseconds = useNowMilliseconds();
  const status = getFellowshipLogsRateLimitStatus(
    rateLimitData,
    nowMilliseconds,
  );

  return (
    <dl className={cn("grid grid-cols-3 gap-4 text-sm", className)}>
      {getRateLimitDataItems(status, nowMilliseconds).map(
        ({ isWarning, label, value }) => {
          return (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd
                className={cn(
                  "font-medium tabular-nums",
                  isWarning && "text-destructive",
                )}
              >
                {value}
              </dd>
            </div>
          );
        },
      )}
    </dl>
  );
}
