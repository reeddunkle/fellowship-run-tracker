import { RouterProvider } from "@tanstack/react-router";
import * as Cause from "effect/Cause";
import * as E from "effect/Effect";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppStateInitializationError } from "@/errors/app-state-error.ts";
import { RendererInvariantError } from "@/errors/renderer-invariant-error.ts";
import { primeAppStateQueries } from "@/renderer/api/app-state/app-state-queries.ts";
import { configureRendererErrorLogging } from "@/renderer/logging/renderer-error-logging.ts";
import { router } from "@/renderer/router/router";
import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";
import { backgroundJobEventStore } from "@/renderer/stores/background-job/background-job-event-store.ts";
import { dungeonRunEventStore } from "@/renderer/stores/dungeon-run/dungeon-run-event-store.ts";
import { trackingEventStore } from "@/renderer/stores/tracking/tracking-event-store.ts";

import "./styles.css";

import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/renderer/query/query-client.ts";

configureRendererErrorLogging();

const rootElement = document.querySelector<HTMLElement>("#root");

if (rootElement === null) {
  throw new RendererInvariantError({
    description: "Required renderer root element is missing.",
  });
}

browserRuntime.runFork(
  E.gen(function* () {
    yield* E.tryPromise({
      catch: (cause) => new AppStateInitializationError({ cause }),
      try: () => {
        return primeAppStateQueries(queryClient);
      },
    });

    backgroundJobEventStore.start();
    dungeonRunEventStore.start();
    trackingEventStore.start();

    createRoot(rootElement).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </StrictMode>,
    );
  }).pipe(
    E.tapCause((cause) => {
      return E.logFatal("The renderer failed to start.", {
        cause: Cause.pretty(cause),
      });
    }),
  ),
);
