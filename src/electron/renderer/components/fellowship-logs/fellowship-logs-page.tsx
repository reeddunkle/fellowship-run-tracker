import { RefreshCwIcon, XCircleIcon } from "lucide-react";
import { useEffect } from "react";

import { AppLayout } from "@/electron/renderer/components/core/app-layout.tsx";
import { FellowshipLogsRateLimitData } from "@/electron/renderer/components/fellowship-logs/fellowship-logs-rate-limit-data.tsx";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import { Card, CardContent } from "@/electron/renderer/components/ui/card.tsx";
import { Separator } from "@/electron/renderer/components/ui/separator.tsx";
import { Spinner } from "@/electron/renderer/components/ui/spinner.tsx";
import { useFellowshipLogsStore } from "@/electron/renderer/stores/fellowship-logs-store/use-fellowship-logs-store.ts";
import { type DungeonApiDungeonList } from "@/services/api/dungeon/dungeon-api-schema.ts";

import { ImportDungeonRunSection } from "./import-dungeon-run-section.tsx";
import { ImportedDungeonRunsList } from "./imported-dungeon-runs-list.tsx";

type FellowshipLogsPageProps = {
  readonly dungeons: DungeonApiDungeonList;
};

export function FellowshipLogsPage({ dungeons }: FellowshipLogsPageProps) {
  const {
    hasLoadedRateLimitData,
    isLoadingLastKnownRateLimitData,
    isRefreshingRateLimitData,
    loadLastKnownRateLimitData,
    rateLimitData,
    refreshRateLimitData,
    refreshRateLimitDataError,
  } = useFellowshipLogsStore();

  useEffect(() => {
    loadLastKnownRateLimitData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppLayout>
      <main className="mx-auto grid w-full max-w-5xl gap-6 p-6">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">Fellowship Logs</h1>
          <p className="text-sm text-muted-foreground">
            Import dungeon runs from Fellowship Logs and manage your rate limit.
          </p>
        </div>
        <Card>
          <CardContent className="grid gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Rate limit</p>
              {isLoadingLastKnownRateLimitData || isRefreshingRateLimitData ? (
                <Spinner />
              ) : null}
            </div>
            {refreshRateLimitDataError !== undefined ? (
              <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <XCircleIcon className="size-3.5" />
                Failed to load rate limit data.
              </div>
            ) : rateLimitData !== null ? (
              <FellowshipLogsRateLimitData rateLimitData={rateLimitData} />
            ) : hasLoadedRateLimitData ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  No recently queried rate limit data yet.
                </p>
                <Button
                  disabled={isRefreshingRateLimitData}
                  onClick={refreshRateLimitData}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCwIcon />
                  Fetch latest
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Separator />
        <div className="grid gap-2">
          <p className="text-sm font-medium">Import a run</p>
          <ImportDungeonRunSection dungeons={dungeons} />
        </div>
        <Separator />
        <div className="grid gap-2">
          <p className="text-sm font-medium">Imported runs</p>
          <ImportedDungeonRunsList />
        </div>
      </main>
    </AppLayout>
  );
}
