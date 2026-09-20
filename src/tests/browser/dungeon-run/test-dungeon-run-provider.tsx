import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { getConfigurationsQueryOptions } from "@/electron/renderer/api/configuration/configuration-queries.ts";
import { getDungeonRunHistoryQueryOptions } from "@/electron/renderer/api/dungeon-run/dungeon-run-queries.ts";
import { type DungeonRunEventStore } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-event-store.ts";
import { DungeonRunProvider } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";
import { makeTrackingEventStore } from "@/electron/renderer/stores/tracking-store/tracking-event-store.ts";
import { DEFAULT_APP_STATE } from "@/electron/storage/app-state/app-state-schema.ts";
import { type ConfigurationApiConfigurationList } from "@/services/api/configuration/configuration-api-schema.ts";
import {
  type DungeonRunApiComparisonGroup,
  type DungeonRunApiHistory,
} from "@/services/api/dungeon-run/dungeon-run-api-schema.ts";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";
import { seedAppStateQueries } from "@/tests/browser/helpers/seed-app-state-queries.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

type TestDungeonRunHistorySeed = {
  readonly dungeonId: DungeonId;
  readonly dungeonLevel: number;
  readonly value: DungeonRunApiHistory;
};

type TestDungeonRunProviderProps = {
  readonly children: ReactNode;
  readonly comparisonGroup?: DungeonRunApiComparisonGroup;
  readonly configurations?: ConfigurationApiConfigurationList;
  readonly eventStore: DungeonRunEventStore;
  readonly history?: TestDungeonRunHistorySeed;
  readonly selectedConfigurationId?: ConfigurationId | null;
};

export function TestDungeonRunProvider({
  children,
  comparisonGroup = "OWN",
  configurations = [],
  eventStore,
  history,
  selectedConfigurationId = null,
}: TestDungeonRunProviderProps) {
  const [queryClient] = useState(() => {
    const client = new QueryClient();

    client.setQueryData(
      getConfigurationsQueryOptions().queryKey,
      configurations,
    );

    seedAppStateQueries(client, {
      ...DEFAULT_APP_STATE,
      dungeonRun: {
        ...DEFAULT_APP_STATE.dungeonRun,
        comparisonGroup,
      },
      selectedConfigurationId,
    });

    if (history !== undefined) {
      client.setQueryData(
        getDungeonRunHistoryQueryOptions({
          dungeonId: history.dungeonId,
          dungeonLevel: history.dungeonLevel,
        }).queryKey,
        history.value,
      );
    }

    return client;
  });

  const [testTrackingEventStore] = useState(() => {
    return makeTrackingEventStore();
  });

  return (
    <QueryClientProvider client={queryClient}>
      <DungeonRunProvider
        eventStore={eventStore}
        trackingEventStore={testTrackingEventStore}
      >
        {children}
      </DungeonRunProvider>
    </QueryClientProvider>
  );
}
