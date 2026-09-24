import { useQuery } from "@tanstack/react-query";

import {
  type FellowshipLogsRateLimitStatus,
  getFellowshipLogsRateLimitStatus,
} from "@frt/shared/fellowship-logs/get-fellowship-logs-rate-limit-status.ts";

import { useNowMilliseconds } from "@/renderer/stores/clock/use-now-milliseconds.ts";

import { getFellowshipLogsLastKnownRateLimitDataQueryOptions } from "./fellowship-logs-queries.ts";

type FellowshipLogsRateLimitStatusResult = {
  readonly nowMilliseconds: number;
  readonly status: FellowshipLogsRateLimitStatus | null;
};

export function useFellowshipLogsRateLimitStatus(): FellowshipLogsRateLimitStatusResult {
  const nowMilliseconds = useNowMilliseconds();
  const { data } = useQuery(
    getFellowshipLogsLastKnownRateLimitDataQueryOptions(),
  );

  return {
    nowMilliseconds,
    status:
      data === null || data === undefined
        ? null
        : getFellowshipLogsRateLimitStatus(data, nowMilliseconds),
  };
}
