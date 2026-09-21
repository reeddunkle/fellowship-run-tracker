import { RouterProvider } from "@tanstack/react-router";
import * as E from "effect/Effect";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { primeAppStateQueries } from "@/electron/renderer/api/app-state/app-state-queries.ts";
import { router } from "@/electron/renderer/router/router";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import { dungeonRunEventStore } from "@/electron/renderer/stores/dungeon-run/dungeon-run-event-store.ts";
import { trackingEventStore } from "@/electron/renderer/stores/tracking/tracking-event-store.ts";
import { AppStateInitializationError } from "@/errors/app-state-error.ts";
import { RendererInvariantError } from "@/errors/renderer-invariant-error.ts";

import "./styles.css";

import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/electron/renderer/query/query-client.ts";

const rootElement = document.querySelector<HTMLElement>("#root");

if (rootElement === null) {
  throw new RendererInvariantError({
    message: "Required renderer root element is missing.",
  });
}

browserRuntime.runPromise(
  E.gen(function* () {
    yield* E.tryPromise({
      catch: (cause) => new AppStateInitializationError({ cause }),
      try: () => {
        return primeAppStateQueries(queryClient);
      },
    });

    dungeonRunEventStore.start();
    trackingEventStore.start();

    createRoot(rootElement).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </StrictMode>,
    );
  }),
);
