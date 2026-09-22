import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { MOCK_CONFIGURATION } from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { type DungeonRunApiHistory } from "@frt/shared/dungeon-run/dungeon-run-api-schema.ts";

import { getDungeonRunHistoryQueryOptions } from "@/renderer/api/dungeon-run/dungeon-run-queries.ts";
import { HistoryPageContent } from "@/renderer/components/history/history-page-content.tsx";
import { FellowshipDataProvider } from "@/renderer/stores/fellowship-data/fellowship-data-store.tsx";
import { TestConfigurationProvider } from "@/tests/browser/test-configuration-provider.tsx";

test("keeps the heading visible while history suspends, then shows data", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const pending = Promise.withResolvers<DungeonRunApiHistory>();
  const request = client.prefetchQuery({
    ...getDungeonRunHistoryQueryOptions(MOCK_CONFIGURATION),
    queryFn: () => pending.promise,
  });
  try {
    const screen = await render(
      <QueryClientProvider client={client}>
        <TestConfigurationProvider
          client={client}
          configuration={MOCK_CONFIGURATION}
        >
          <FellowshipDataProvider
            abilities={[]}
            dungeons={[]}
            encounters={[]}
            units={[]}
          >
            <HistoryPageContent />
          </FellowshipDataProvider>
        </TestConfigurationProvider>
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
  }
});
