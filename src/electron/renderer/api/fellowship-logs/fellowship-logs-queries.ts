import { queryOptions } from "@tanstack/react-query";

import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";

import {
  getImportedDungeonRuns,
  getLastKnownRateLimitData,
} from "./fellowship-logs-client.ts";

export function getFellowshipLogsDungeonRunsQueryOptions() {
  return queryOptions({
    queryFn: () => {
      return browserRuntime.runPromise(getImportedDungeonRuns());
    },
    queryKey: ["fellowship-logs", "dungeon-runs"],
    staleTime: Infinity,
  });
}

export function getFellowshipLogsLastKnownRateLimitDataQueryOptions() {
  return queryOptions({
    queryFn: () => {
      return browserRuntime.runPromise(getLastKnownRateLimitData());
    },
    queryKey: ["fellowship-logs", "rate-limit-data", "last-known"],
    staleTime: Infinity,
  });
}
