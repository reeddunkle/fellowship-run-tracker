import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { getConfigurationsQueryOptions } from "@/electron/renderer/api/configuration/configuration-queries.ts";
import { getDungeonRunHistoryQueryOptions } from "@/electron/renderer/api/dungeon-run/dungeon-run-queries.ts";
import { HistoryPageContent } from "@/electron/renderer/components/history/history-page-content.tsx";
import { appStore } from "@/electron/renderer/stores/app-state-store/app-state-store.ts";
import { ConfigurationProvider } from "@/electron/renderer/stores/configurations-store/configurations-store.tsx";
import { FellowshipDataProvider } from "@/electron/renderer/stores/fellowship-data/fellowship-data-store.tsx";
import { type DungeonRunApiHistory } from "@/services/api/dungeon-run/dungeon-run-api-schema.ts";
import { MOCK_CONFIGURATION } from "@/tests/common/fixtures/configuration-fixtures.ts";

test("keeps the heading visible while history suspends, then shows data", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(getConfigurationsQueryOptions().queryKey, [
    MOCK_CONFIGURATION,
  ]);
  appStore.setSelectedConfigurationId(MOCK_CONFIGURATION.id);
  const pending = Promise.withResolvers<DungeonRunApiHistory>();
  const request = client.prefetchQuery({
    ...getDungeonRunHistoryQueryOptions(MOCK_CONFIGURATION),
    queryFn: () => pending.promise,
  });
  try {
    const screen = await render(
      <QueryClientProvider client={client}>
        <ConfigurationProvider>
          <FellowshipDataProvider
            abilities={[]}
            dungeons={[]}
            encounters={[]}
            units={[]}
          >
            <HistoryPageContent />
          </FellowshipDataProvider>
        </ConfigurationProvider>
      </QueryClientProvider>,
    );
    await expect
      .element(screen.getByRole("heading", { exact: true, name: "History" }))
      .toBeVisible();
    await expect
      .element(screen.getByLabelText("Loading history"))
      .toBeVisible();
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0);
    pending.resolve({
      comparisonRunCount: 0,
      comparisonSampleCount: 0,
      observations: [],
      ownRunCount: 2,
      ownSampleCount: 3,
    });
    await request;
    await expect
      .element(screen.getByText("3 historical samples across 2 tracked runs."))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Clear historical times" }))
      .toBeVisible();
    await expect
      .element(screen.getByLabelText("Loading history"))
      .not.toBeInTheDocument();
    await screen.unmount();
  } finally {
    client.clear();
    appStore.setSelectedConfigurationId(null);
  }
});
