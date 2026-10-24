import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as DateTime from "effect/DateTime";
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { type FellowshipLogsApiImportedDungeonRunList } from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";
import { type FellowshipLogsApiPointPools } from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";

import {
  getFellowshipLogsDungeonRunsQueryOptions,
  getFellowshipLogsImportCostEstimateQueryOptions,
  getFellowshipLogsPointPoolsQueryOptions,
} from "@/renderer/api/fellowship-logs/fellowship-logs-queries.ts";
import { getFellowshipLogsConnectionStatusQueryOptions } from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-queries.ts";
import {
  FellowshipLogsPointsDialog,
  HowPointsWorkButton,
} from "@/renderer/components/fellowship-logs/fellowship-logs-points-section.tsx";
import { ImportedDungeonRunsList } from "@/renderer/components/fellowship-logs/imported-dungeon-runs-list.tsx";

function makeQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  client.setQueryData(
    getFellowshipLogsConnectionStatusQueryOptions().queryKey,
    { authorization: { state: "IDLE" }, connection: null },
  );
  client.setQueryData(
    getFellowshipLogsImportCostEstimateQueryOptions().queryKey,
    null,
  );

  return client;
}

const UNREPORTED_POOL = {
  hasRemainingPoints: null,
  limitPerHour: null,
  pointsRemaining: null,
  resetSource: null,
  resetsAtMilliseconds: null,
} as const;

test("loads each Fellowship Logs section independently with skeletons", async () => {
  const client = makeQueryClient();
  const runs = Promise.withResolvers<FellowshipLogsApiImportedDungeonRunList>();
  const pointPools = Promise.withResolvers<FellowshipLogsApiPointPools>();
  const runsRequest = client.prefetchQuery({
    ...getFellowshipLogsDungeonRunsQueryOptions(),
    queryFn: () => runs.promise,
  });
  const pointPoolsRequest = client.prefetchQuery({
    ...getFellowshipLogsPointPoolsQueryOptions(),
    queryFn: () => pointPools.promise,
  });
  try {
    const screen = await render(
      <QueryClientProvider client={client}>
        <FellowshipLogsPointsDialog>
          <HowPointsWorkButton />
        </FellowshipLogsPointsDialog>
        <ImportedDungeonRunsList />
      </QueryClientProvider>,
    );
    const pointsTrigger = screen.getByRole("button", {
      name: "How points work",
    });
    await pointsTrigger.click();
    await expect.element(screen.getByRole("dialog")).toBeVisible();
    await expect
      .element(
        screen.getByRole("heading", {
          name: "Hourly limits by subscription (beta)",
        }),
      )
      .toBeVisible();
    await expect
      .element(screen.getByText("Points", { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByLabelText("Loading point data"))
      .toBeVisible();
    await expect
      .element(screen.getByLabelText("Loading imported runs"))
      .toBeVisible();

    pointPools.resolve(null);
    await pointPoolsRequest;
    await expect
      .element(screen.getByRole("button", { name: "Fetch latest" }))
      .toBeVisible();
    await expect.element(screen.getByText(/No point data yet/u)).toBeVisible();
    await expect
      .element(screen.getByLabelText("Loading point data"))
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

    const nowMilliseconds = DateTime.toEpochMillis(DateTime.nowUnsafe());

    client.setQueryData(
      getFellowshipLogsPointPoolsQueryOptions().queryKey,
      () => ({
        observedAtMilliseconds: nowMilliseconds,
        pools: {
          APPLICATION: {
            hasRemainingPoints: true,
            limitPerHour: 5000,
            pointsRemaining: 4975,
            resetSource: "pointsResetIn" as const,
            resetsAtMilliseconds: nowMilliseconds + 3_600_000,
          },
          DATABASE: UNREPORTED_POOL,
          USER: UNREPORTED_POOL,
        },
      }),
    );
    await expect
      .element(screen.getByText("4,975 of 5,000 left", { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByText(/^Resets in 60 minutes, at /u))
      .toBeVisible();
    await screen.getByRole("button", { name: "Close" }).click();
    await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
    await expect.element(pointsTrigger).toHaveFocus();
    await screen.unmount();
  } finally {
    client.clear();
  }
});

type SectionRequests = {
  readonly failure: Error;
  readonly pointPools: PromiseWithResolvers<FellowshipLogsApiPointPools>;
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
  const client = makeQueryClient();
  const runs = Promise.withResolvers<FellowshipLogsApiImportedDungeonRunList>();
  const pointPools = Promise.withResolvers<FellowshipLogsApiPointPools>();
  const runsRequest = client.prefetchQuery({
    ...getFellowshipLogsDungeonRunsQueryOptions(),
    queryFn: () => runs.promise,
  });
  const pointPoolsRequest = client.prefetchQuery({
    ...getFellowshipLogsPointPoolsQueryOptions(),
    queryFn: () => pointPools.promise,
  });
  const onCaughtError = vi.fn();
  const failure = new Error(failureMessage);
  try {
    const screen = await render(
      <QueryClientProvider client={client}>
        <FellowshipLogsPointsDialog>
          <HowPointsWorkButton />
        </FellowshipLogsPointsDialog>
        <ImportedDungeonRunsList />
      </QueryClientProvider>,
      { createRootOptions: { onCaughtError } },
    );
    await screen.getByRole("button", { name: "How points work" }).click();
    settleRequests({ failure, pointPools, runs });
    await Promise.all([runsRequest, pointPoolsRequest]);
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
      otherSectionText:
        "No point data yet. It appears after your next Fellowship Logs request.",
      sectionErrorText: "Failed to load imported runs.",
      settleRequests: ({ failure, pointPools, runs }) => {
        runs.reject(failure);
        pointPools.resolve(null);
      },
    });
  });

  test("point pools", async () => {
    await expectLoadFailureContained({
      failureMessage: "Point pools unavailable",
      otherSectionText: "No Fellowship Logs runs imported yet.",
      sectionErrorText: "Failed to load point data.",
      settleRequests: ({ failure, pointPools, runs }) => {
        runs.resolve([]);
        pointPools.reject(failure);
      },
    });
  });
});
