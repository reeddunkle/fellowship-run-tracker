import { createHashHistory, createRouter } from "@tanstack/react-router";

import { queryClient } from "@/renderer/query/query-client.ts";
import { routeTree } from "@/renderer/router/routeTree.gen";
import { browserRuntime } from "@/renderer/runtimes/browser-runtime";

const history = createHashHistory();

export const router = createRouter({
  context: {
    browserRuntime,
    queryClient,
  },
  history,
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
