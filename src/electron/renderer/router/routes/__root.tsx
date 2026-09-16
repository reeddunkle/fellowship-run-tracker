import { createRootRouteWithContext } from "@tanstack/react-router";
import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as Option from "effect/Option";

import { type DungeonRunStateApi } from "@/api/websocket/dungeon-run/dungeon-run-api-message-schema.ts";
import { type TrackingApiStatus } from "@/application/fellowship-tracker/tracking-api-schema.ts";
import { getAppSettings } from "@/electron/renderer/api/app-settings/app-settings-client.ts";
import { getConfigurationsQueryOptions } from "@/electron/renderer/api/configuration/configuration-queries.ts";
import { getDungeonRunHistory } from "@/electron/renderer/api/dungeon-run/dungeon-run-client.ts";
import { RootLayout } from "@/electron/renderer/components/core/root-layout";
import { type RouterContext } from "@/electron/renderer/router/router-context";
import { appStore } from "@/electron/renderer/stores/app-state-store/app-state-store.ts";
import { dungeonRunEventStore } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-event-store.ts";
import { type DungeonRunHistoryKey } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-history-key.ts";
import { trackingEventStore } from "@/electron/renderer/stores/tracking-store/tracking-event-store.ts";
import { QueryClientOperationError } from "@/errors/query-client-operation-error.ts";
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

    return context.browserRuntime.runPromise(
      E.gen(function* () {
        const configurations = yield* E.tryPromise({
          catch: (cause) => {
            return new QueryClientOperationError({
              cause,
              operation: "QUERY",
            });
          },
          try: () => {
            return context.queryClient.query({
              ...getConfigurationsQueryOptions(),
              staleTime: "static",
            });
          },
        });

        const historyConfigurationId = getHistoryConfigurationId({
          runState,
          selectedConfigurationId,
          trackingStatus,
        });

        const historyConfiguration =
          historyConfigurationId === null
            ? Option.none()
            : A.findFirst(configurations, (configuration) => {
                return configuration.id === historyConfigurationId;
              });

        const historyKey: DungeonRunHistoryKey | null = Option.isNone(
          historyConfiguration,
        )
          ? null
          : {
              dungeonId: historyConfiguration.value.dungeonId,
              dungeonLevel: historyConfiguration.value.dungeonLevel,
            };

        const history =
          historyKey === null
            ? null
            : yield* getDungeonRunHistory({
                dungeonId: historyKey.dungeonId,
                dungeonLevel: historyKey.dungeonLevel,
              });

        const settings = yield* getAppSettings();

        return {
          configurations,
          history,
          historyKey,
          settings,
        };
      }),
    );
  },
});
