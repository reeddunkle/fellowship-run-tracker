import { useQuery } from "@tanstack/react-query";
import * as DateTime from "effect/DateTime";
import { useEffect, useState } from "react";

import {
  type FellowshipLogsRateLimitStatus,
  getFellowshipLogsRateLimitStatus,
} from "@frt/shared/fellowship-logs/get-fellowship-logs-rate-limit-status.ts";

import { getFellowshipLogsLastKnownRateLimitDataQueryOptions } from "./fellowship-logs-queries.ts";

const CLOCK_INTERVAL_MILLISECONDS = 5_000;

function getNowMilliseconds() {
  return DateTime.toEpochMillis(DateTime.nowUnsafe());
}

// [TODO] Remove `useEffect`
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
