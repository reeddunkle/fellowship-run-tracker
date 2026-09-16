import { queryOptions } from "@tanstack/react-query";

import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";

import { getImportedDungeonRuns } from "./fellowship-logs-client.ts";

export function getFellowshipLogsDungeonRunsQueryOptions() {
  return queryOptions({
    queryFn: () => {
      return browserRuntime.runPromise(getImportedDungeonRuns());
    },
    queryKey: ["fellowship-logs", "dungeon-runs"],
  });
}
