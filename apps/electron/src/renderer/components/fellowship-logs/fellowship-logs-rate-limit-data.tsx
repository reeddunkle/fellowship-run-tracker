import { type FellowshipLogsApiRateLimitData } from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";
import { getFellowshipLogsRateLimitStatus } from "@frt/shared/fellowship-logs/get-fellowship-logs-rate-limit-status.ts";
import {
  Stat,
  StatLabel,
  StatList,
  StatValue,
} from "@frt/ui/composites/stat-list.tsx";

import { getRateLimitDataItems } from "@/renderer/api/fellowship-logs/fellowship-logs-rate-limit-messages.ts";
import { useNowMilliseconds } from "@/renderer/stores/clock/use-now-milliseconds.ts";

type FellowshipLogsRateLimitDataProps = {
  readonly rateLimitData: FellowshipLogsApiRateLimitData;
};

export function FellowshipLogsRateLimitData({
  rateLimitData,
}: FellowshipLogsRateLimitDataProps) {
  const nowMilliseconds = useNowMilliseconds();
  const status = getFellowshipLogsRateLimitStatus(
    rateLimitData,
    nowMilliseconds,
  );

  return (
    <StatList className="grid-cols-3">
      {getRateLimitDataItems(status, nowMilliseconds).map(
        ({ isWarning, label, value }) => {
          return (
            <Stat key={label}>
              <StatLabel>{label}</StatLabel>
              <StatValue variant={isWarning ? "destructive" : "default"}>
                {value}
              </StatValue>
            </Stat>
          );
        },
      )}
    </StatList>
  );
}
