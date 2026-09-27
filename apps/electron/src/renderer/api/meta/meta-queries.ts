import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";

import { getMeta } from "./meta-client.ts";

export function getMetaQueryOptions() {
  return queryOptions({
    queryFn: () => {
      return browserRuntime.runPromise(getMeta());
    },
    queryKey: ["meta"],
    staleTime: Infinity,
  });
}

export function useMetaSuspense() {
  const { data } = useSuspenseQuery(getMetaQueryOptions());
  return data;
}
