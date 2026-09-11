import { RouterProvider } from "@tanstack/react-router";
import * as E from "effect/Effect";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { router } from "@/electron/renderer/router/router";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import { appStore } from "@/electron/renderer/stores/app-state-store/app-state-store.ts";
import { dungeonRunEventStore } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-event-store.ts";
import { trackingEventStore } from "@/electron/renderer/stores/tracking-store/tracking-event-store.ts";
import { RendererInvariantError } from "@/errors/renderer-invariant-error.ts";

import "./styles.css";

const rootElement = document.querySelector<HTMLElement>("#root");

if (rootElement === null) {
  throw new RendererInvariantError({
    message: "Required renderer root element is missing.",
  });
}

function invalidateDungeonRunHistory(): void {
  void router.invalidate({
    filter: (match) => {
      return match.routeId === "__root__";
    },
  });
}

function isDungeonRunActive(): boolean {
  const { runState } = dungeonRunEventStore.getSnapshot();

  return runState?.dungeonRun?.status === "ACTIVE";
}

browserRuntime.runPromise(
  E.gen(function* () {
    yield* appStore.initialize;

    dungeonRunEventStore.start();
    trackingEventStore.start();

    let selectedConfigurationId =
      appStore.getSnapshot().selectedConfigurationId;

    let runState = dungeonRunEventStore.getSnapshot().runState;
    let trackingStatus = trackingEventStore.getSnapshot().trackingStatus;

    appStore.subscribe(() => {
      const nextSelectedConfigurationId =
        appStore.getSnapshot().selectedConfigurationId;

      if (nextSelectedConfigurationId === selectedConfigurationId) {
        return;
      }

      selectedConfigurationId = nextSelectedConfigurationId;

      if (isDungeonRunActive()) {
        return;
      }

      invalidateDungeonRunHistory();
    });

    trackingEventStore.subscribe(() => {
      const nextTrackingStatus =
        trackingEventStore.getSnapshot().trackingStatus;

      if (nextTrackingStatus === trackingStatus) {
        return;
      }

      trackingStatus = nextTrackingStatus;

      if (!isDungeonRunActive()) {
        return;
      }

      invalidateDungeonRunHistory();
    });

    dungeonRunEventStore.subscribe(() => {
      const nextRunState = dungeonRunEventStore.getSnapshot().runState;

      const previousRunStatus = runState?.dungeonRun?.status;
      const nextRunStatus = nextRunState?.dungeonRun?.status;

      runState = nextRunState;

      if (nextRunStatus === previousRunStatus) {
        return;
      }

      invalidateDungeonRunHistory();
    });

    createRoot(rootElement).render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );
  }),
);
