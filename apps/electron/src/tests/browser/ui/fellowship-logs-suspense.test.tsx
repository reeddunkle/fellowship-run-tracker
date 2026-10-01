import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as DateTime from "effect/DateTime";
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import {
  type FellowshipLogsApiImportedDungeonRunList,
  type FellowshipLogsApiLastKnownRateLimitData,
} from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";

import {
  getFellowshipLogsDungeonRunsQueryOptions,
  getFellowshipLogsLastKnownRateLimitDataQueryOptions,
} from "@/renderer/api/fellowship-logs/fellowship-logs-queries.ts";
import { FellowshipLogsRateLimitSection } from "@/renderer/components/fellowship-logs/fellowship-logs-rate-limit-section.tsx";
import { ImportedDungeonRunsList } from "@/renderer/components/fellowship-logs/imported-dungeon-runs-list.tsx";

test("loads each Fellowship Logs section independently with skeletons", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const runs = Promise.withResolvers<FellowshipLogsApiImportedDungeonRunList>();
  const rateLimit =
    Promise.withResolvers<FellowshipLogsApiLastKnownRateLimitData>();
  const runsRequest = client.prefetchQuery({
    ...getFellowshipLogsDungeonRunsQueryOptions(),
    queryFn: () => runs.promise,
  });
  const rateLimitRequest = client.prefetchQuery({
    ...getFellowshipLogsLastKnownRateLimitDataQueryOptions(),
    queryFn: () => rateLimit.promise,
  });
  try {
    const screen = await render(
      <QueryClientProvider client={client}>
        <FellowshipLogsRateLimitSection />
        <ImportedDungeonRunsList />
      </QueryClientProvider>,
    );
    await expect
      .element(screen.getByText("Rate limit", { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByLabelText("Loading rate limit data"))
      .toBeVisible();
    await expect
      .element(screen.getByLabelText("Loading imported runs"))
      .toBeVisible();

    rateLimit.resolve(null);
    await rateLimitRequest;
    await expect
      .element(screen.getByRole("button", { name: "Fetch latest" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("No recently queried rate limit data yet."))
      .toBeVisible();
    await expect
      .element(screen.getByLabelText("Loading rate limit data"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByLabelText("Loading imported runs"))
      .toBeVisible();

    runs.resolve([]);
    await runsRequest;
    await expect
      .element(screen.getByText("No Fellowship Logs runs imported yet."))
      .toBeVisible();
    await expect
      .element(screen.getByLabelText("Loading imported runs"))
      .not.toBeInTheDocument();

    client.setQueryData(
      getFellowshipLogsLastKnownRateLimitDataQueryOptions().queryKey,
      () => ({
        limitPerHour: 5000,
        observedAtMilliseconds: DateTime.toEpochMillis(DateTime.nowUnsafe()),
        pointsResetIn: 3600,
        pointsSpentThisHour: 25,
      }),
    );
    await expect
      .element(screen.getByText("4,975", { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByText("5,000", { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByText("60 minutes", { exact: true }))
      .toBeVisible();
    await screen.unmount();
  } finally {
    client.clear();
  }
});

type SectionRequests = {
  readonly failure: Error;
  readonly rateLimit: PromiseWithResolvers<FellowshipLogsApiLastKnownRateLimitData>;
  readonly runs: PromiseWithResolvers<FellowshipLogsApiImportedDungeonRunList>;
};

async function expectLoadFailureContained({
  failureMessage,
  otherSectionText,
  sectionErrorText,
  settleRequests,
}: {
  readonly failureMessage: string;
  readonly otherSectionText: string;
  readonly sectionErrorText: string;
  readonly settleRequests: (requests: SectionRequests) => void;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const runs = Promise.withResolvers<FellowshipLogsApiImportedDungeonRunList>();
  const rateLimit =
    Promise.withResolvers<FellowshipLogsApiLastKnownRateLimitData>();
  const runsRequest = client.prefetchQuery({
    ...getFellowshipLogsDungeonRunsQueryOptions(),
    queryFn: () => runs.promise,
  });
  const rateLimitRequest = client.prefetchQuery({
    ...getFellowshipLogsLastKnownRateLimitDataQueryOptions(),
    queryFn: () => rateLimit.promise,
  });
  const onCaughtError = vi.fn();
  const failure = new Error(failureMessage);
  try {
    const screen = await render(
      <QueryClientProvider client={client}>
        <FellowshipLogsRateLimitSection />
        <ImportedDungeonRunsList />
      </QueryClientProvider>,
      { createRootOptions: { onCaughtError } },
    );
    settleRequests({ failure, rateLimit, runs });
    await Promise.all([runsRequest, rateLimitRequest]);
    await expect.element(screen.getByText(sectionErrorText)).toBeVisible();
    await expect.element(screen.getByText(otherSectionText)).toBeVisible();
    expect(onCaughtError).toHaveBeenCalledOnce();
    expect(onCaughtError).toHaveBeenCalledWith(failure, expect.anything());
    await screen.unmount();
  } finally {
    client.clear();
  }
}

describe("contains a load failure within its section", () => {
  test("imported runs", async () => {
    await expectLoadFailureContained({
      failureMessage: "Imported runs unavailable",
      otherSectionText: "No recently queried rate limit data yet.",
      sectionErrorText: "Failed to load imported runs.",
      settleRequests: ({ failure, rateLimit, runs }) => {
        runs.reject(failure);
        rateLimit.resolve(null);
      },
    });
  });

  test("rate limit", async () => {
    await expectLoadFailureContained({
      failureMessage: "Rate limit unavailable",
      otherSectionText: "No Fellowship Logs runs imported yet.",
      sectionErrorText: "Failed to load rate limit data.",
      settleRequests: ({ failure, rateLimit, runs }) => {
        runs.resolve([]);
        rateLimit.reject(failure);
      },
    });
  });
});
