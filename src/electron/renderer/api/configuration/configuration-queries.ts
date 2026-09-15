import { queryOptions } from "@tanstack/react-query";

import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";

import { getConfigurations } from "./configuration-client.ts";

export function getConfigurationsQueryOptions() {
  return queryOptions({
    queryFn: () => {
      return browserRuntime.runPromise(getConfigurations());
    },
    queryKey: ["configurations"],
    staleTime: Infinity,
  });
}
