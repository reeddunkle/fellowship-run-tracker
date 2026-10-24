import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";

import {
  getAnalytics,
  getImportCostEstimate,
  getImportedDungeonRuns,
  getPointPools,
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

export function getFellowshipLogsPointPoolsQueryOptions() {
  return queryOptions({
    queryFn: () => {
      return browserRuntime.runPromise(getPointPools());
    },
    queryKey: ["fellowship-logs", "point-pools"],
    staleTime: Infinity,
  });
}

export function getFellowshipLogsImportCostEstimateQueryOptions() {
  return queryOptions({
    queryFn: () => {
      return browserRuntime.runPromise(getImportCostEstimate());
    },
    queryKey: ["fellowship-logs", "import-cost-estimate"],
    staleTime: Infinity,
  });
}

function getFellowshipLogsAnalyticsQueryOptions() {
  return queryOptions({
    queryFn: () => {
      return browserRuntime.runPromise(getAnalytics());
    },
    queryKey: ["fellowship-logs", "analytics"],
    staleTime: Infinity,
  });
}

export function useFellowshipLogsAnalyticsSuspense() {
  return useSuspenseQuery(getFellowshipLogsAnalyticsQueryOptions());
}

export function useImportedDungeonRunsSuspense() {
  const { data } = useSuspenseQuery(getFellowshipLogsDungeonRunsQueryOptions());
  return data;
}

export function useFellowshipLogsPointPoolsSuspense() {
  const { data } = useSuspenseQuery(getFellowshipLogsPointPoolsQueryOptions());
  return data;
}

export function useFellowshipLogsImportCostEstimateSuspense() {
  const { data } = useSuspenseQuery(
    getFellowshipLogsImportCostEstimateQueryOptions(),
  );
  return data;
}
