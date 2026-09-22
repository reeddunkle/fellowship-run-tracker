import { type QueryClient } from "@tanstack/react-query";

import { type browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";

export type RouterContext = {
  readonly browserRuntime: typeof browserRuntime;
  readonly queryClient: QueryClient;
};
