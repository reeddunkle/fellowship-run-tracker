import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { DEFAULT_APP_STATE } from "@frt/shared/app-state/app-state-schema.ts";
import { type ConfigurationApiConfigurationList } from "@frt/shared/configuration/configuration-api-schema.ts";
import { type ConfigurationId } from "@frt/shared/configuration/configuration-id-schema.ts";
import {
  type DungeonRunApiComparisonGroup,
  type DungeonRunApiHistory,
} from "@frt/shared/dungeon-run/dungeon-run-api-schema.ts";
import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";

import { getConfigurationsQueryOptions } from "@/renderer/api/configuration/configuration-queries.ts";
import { getDungeonRunHistoryQueryOptions } from "@/renderer/api/dungeon-run/dungeon-run-queries.ts";
import { type DungeonRunEventStore } from "@/renderer/stores/dungeon-run/dungeon-run-event-store.ts";
import { DungeonRunProvider } from "@/renderer/stores/dungeon-run/dungeon-run-provider.tsx";
import { makeTrackingEventStore } from "@/renderer/stores/tracking/tracking-event-store.ts";
import { seedAppStateQueries } from "@/tests/browser/helpers/seed-app-state-queries.ts";

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
