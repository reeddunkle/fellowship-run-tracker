import { createHashHistory, createRouter } from "@tanstack/react-router";

import { routeTree } from "@/electron/renderer/router/routeTree.gen";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime";

const history = createHashHistory();

export const router = createRouter({
  context: {
    browserRuntime,
  },
  history,
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
