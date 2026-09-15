import { createHashHistory, createRouter } from "@tanstack/react-router";

import { queryClient } from "@/electron/renderer/query/query-client.ts";
import { routeTree } from "@/electron/renderer/router/routeTree.gen";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime";

const history = createHashHistory();

export const router = createRouter({
  context: {
    browserRuntime,
    queryClient,
  },
  history,
  routeTree,
});

export type AppRouter = typeof router;

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
