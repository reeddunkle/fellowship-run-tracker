import { createRootRouteWithContext } from "@tanstack/react-router";
import * as E from "effect/Effect";
import * as HttpClientError from "effect/unstable/http/HttpClientError";

import { type DungeonRunStateApi } from "@/api/websocket/dungeon-run/dungeon-run-api-message-schema.ts";
import { type TrackingApiStatus } from "@/application/fellowship-tracker/tracking-api-schema.ts";
import { getAppSettings } from "@/electron/renderer/api/app-settings/app-settings-client.ts";
import { getDungeonRunHistory } from "@/electron/renderer/api/dungeon-run/dungeon-run-client.ts";
import { RootLayout } from "@/electron/renderer/components/core/root-layout";
import { type RouterContext } from "@/electron/renderer/router/router-context";
import { appStore } from "@/electron/renderer/stores/app-state-store/app-state-store.ts";
import { dungeonRunEventStore } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-event-store.ts";
import { trackingEventStore } from "@/electron/renderer/stores/tracking-store/tracking-event-store.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

function getHistoryConfigurationId({
  runState,
  selectedConfigurationId,
  trackingStatus,
}: {
  readonly runState: DungeonRunStateApi | null;
  readonly selectedConfigurationId: ConfigurationId | null;
  readonly trackingStatus: TrackingApiStatus | null;
}): ConfigurationId | null {
  if (
    runState?.dungeonRun?.status === "ACTIVE" &&
    trackingStatus?.status === "Tracking" &&
    trackingStatus.source.type === "Persisted"
  ) {
    return trackingStatus.source.configurationId;
  }

  return selectedConfigurationId;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  loader: ({ context }) => {
    const { selectedConfigurationId } = appStore.getSnapshot();
    const { runState } = dungeonRunEventStore.getSnapshot();
    const { trackingStatus } = trackingEventStore.getSnapshot();

    const historyConfigurationId = getHistoryConfigurationId({
      runState,
      selectedConfigurationId,
      trackingStatus,
    });

    const getHistory =
      historyConfigurationId === null
        ? E.succeed(null)
        : getDungeonRunHistory({
            configurationId: historyConfigurationId,
          }).pipe(
            E.catchIf(
              (error) => {
                return (
                  HttpClientError.isHttpClientError(error) &&
                  error.reason._tag === "StatusCodeError" &&
                  error.reason.response.status === 404
                );
              },
              () => E.succeed(null),
            ),
          );

    return context.browserRuntime.runPromise(
      E.all({
        history: getHistory,
        settings: getAppSettings(),
      }),
    );
  },
});
