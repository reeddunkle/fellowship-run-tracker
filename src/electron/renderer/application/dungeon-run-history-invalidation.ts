import { type AppRouter } from "@/electron/renderer/router/router.ts";
import { appStore } from "@/electron/renderer/stores/app-state-store/app-state-store.ts";
import { dungeonRunEventStore } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-event-store.ts";
import { trackingEventStore } from "@/electron/renderer/stores/tracking-store/tracking-event-store.ts";

function invalidateDungeonRunHistory(router: AppRouter): void {
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

export function startDungeonRunHistoryInvalidation(router: AppRouter) {
  let selectedConfigurationId = appStore.getSnapshot().selectedConfigurationId;

  let runState = dungeonRunEventStore.getSnapshot().runState;
  let trackingStatus = trackingEventStore.getSnapshot().trackingStatus;

  const unsubscribeAppStore = appStore.subscribe(() => {
    const nextSelectedConfigurationId =
      appStore.getSnapshot().selectedConfigurationId;

    if (nextSelectedConfigurationId === selectedConfigurationId) {
      return;
    }

    selectedConfigurationId = nextSelectedConfigurationId;

    if (isDungeonRunActive()) {
      return;
    }

    invalidateDungeonRunHistory(router);
  });

  const unsubscribeTrackingEventStore = trackingEventStore.subscribe(() => {
    const nextTrackingStatus = trackingEventStore.getSnapshot().trackingStatus;

    if (nextTrackingStatus === trackingStatus) {
      return;
    }

    trackingStatus = nextTrackingStatus;

    if (!isDungeonRunActive()) {
      return;
    }

    invalidateDungeonRunHistory(router);
  });

  const unsubscribeDungeonRunEventStore = dungeonRunEventStore.subscribe(() => {
    const nextRunState = dungeonRunEventStore.getSnapshot().runState;

    const previousRunStatus = runState?.dungeonRun?.status;
    const nextRunStatus = nextRunState?.dungeonRun?.status;

    runState = nextRunState;

    if (nextRunStatus === previousRunStatus) {
      return;
    }

    invalidateDungeonRunHistory(router);
  });

  return () => {
    unsubscribeAppStore();
    unsubscribeTrackingEventStore();
    unsubscribeDungeonRunEventStore();
  };
}
