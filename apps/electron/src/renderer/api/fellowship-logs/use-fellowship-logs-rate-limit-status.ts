import { useQuery } from "@tanstack/react-query";
import * as DateTime from "effect/DateTime";
import { useEffect, useState } from "react";

import {
  type FellowshipLogsRateLimitStatus,
  getFellowshipLogsRateLimitStatus,
} from "@frt/shared/fellowship-logs/get-fellowship-logs-rate-limit-status.ts";

import { getFellowshipLogsLastKnownRateLimitDataQueryOptions } from "./fellowship-logs-queries.ts";

// Countdowns are shown in whole minutes, so a few seconds of lag is fine.
const CLOCK_INTERVAL_MILLISECONDS = 5_000;

function getNowMilliseconds() {
  return DateTime.toEpochMillis(DateTime.nowUnsafe());
}

/** The current time, updated every few seconds. */
export function useNowMilliseconds(): number {
  const [nowMilliseconds, setNowMilliseconds] = useState(getNowMilliseconds);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMilliseconds(getNowMilliseconds());
    }, CLOCK_INTERVAL_MILLISECONDS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return nowMilliseconds;
}

type FellowshipLogsRateLimitStatusResult = {
  readonly nowMilliseconds: number;
  /** `null` until any rate-limit data has been seen this session. */
  readonly status: FellowshipLogsRateLimitStatus | null;
};

/**
 * The last known rate limit, re-read as time passes so an exhausted limit
 * clears itself once the points reset.
 */
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
