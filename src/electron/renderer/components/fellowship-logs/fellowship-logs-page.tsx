import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon, XCircleIcon } from "lucide-react";

import { refreshFellowshipLogsRateLimitDataMutationOptions } from "@/electron/renderer/api/fellowship-logs/fellowship-logs-mutations.ts";
import { getFellowshipLogsLastKnownRateLimitDataQueryOptions } from "@/electron/renderer/api/fellowship-logs/fellowship-logs-queries.ts";
import { AppLayout } from "@/electron/renderer/components/core/app-layout.tsx";
import { FellowshipLogsRateLimitData } from "@/electron/renderer/components/fellowship-logs/fellowship-logs-rate-limit-data.tsx";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import { Card, CardContent } from "@/electron/renderer/components/ui/card.tsx";
import { Separator } from "@/electron/renderer/components/ui/separator.tsx";
import { Spinner } from "@/electron/renderer/components/ui/spinner.tsx";
import { FellowshipDataProvider } from "@/electron/renderer/stores/fellowship-data/fellowship-data-store.tsx";
import { type AbilityApiAbilityList } from "@/services/api/ability/ability-api-schema.ts";
import { type DungeonApiDungeonList } from "@/services/api/dungeon/dungeon-api-schema.ts";
import { type EncounterApiEncounterList } from "@/services/api/encounter/encounter-api-schema.ts";
import { type UnitApiUnitList } from "@/services/api/unit/unit-api-schema.ts";

import { ImportDungeonRunSection } from "./import-dungeon-run-section.tsx";
import { ImportedDungeonRunsList } from "./imported-dungeon-runs-list.tsx";

type FellowshipLogsPageProps = {
  readonly abilities: AbilityApiAbilityList;
  readonly dungeons: DungeonApiDungeonList;
  readonly encounters: EncounterApiEncounterList;
  readonly units: UnitApiUnitList;
};

export function FellowshipLogsPage({
  abilities,
  dungeons,
  encounters,
  units,
}: FellowshipLogsPageProps) {
  const queryClient = useQueryClient();

  const rateLimitQuery = useQuery(
    getFellowshipLogsLastKnownRateLimitDataQueryOptions(),
  );

  const refreshMutation = useMutation(
    refreshFellowshipLogsRateLimitDataMutationOptions(queryClient),
  );

  const rateLimitData = rateLimitQuery.data ?? null;
  const hasError = rateLimitQuery.isError || refreshMutation.isError;
  const isLoading = rateLimitQuery.isPending || refreshMutation.isPending;

  return (
    <FellowshipDataProvider
      abilities={abilities}
      dungeons={dungeons}
      encounters={encounters}
      units={units}
    >
      <AppLayout>
        <main className="mx-auto grid w-full max-w-5xl gap-6 p-6">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold">Fellowship Logs</h1>
            <p className="text-sm text-muted-foreground">
              Import dungeon runs from Fellowship Logs and manage your rate
              limit.
            </p>
          </div>
          <Card>
            <CardContent className="grid gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Rate limit</p>
                {isLoading ? <Spinner /> : null}
              </div>
              {hasError ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <XCircleIcon className="size-3.5" />
                  Failed to load rate limit data.
                </div>
              ) : rateLimitData !== null ? (
                <FellowshipLogsRateLimitData rateLimitData={rateLimitData} />
              ) : !rateLimitQuery.isPending ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    No recently queried rate limit data yet.
                  </p>
                  <Button
                    disabled={refreshMutation.isPending}
                    onClick={() => {
                      refreshMutation.mutate();
                    }}
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
            <ImportDungeonRunSection />
          </div>
          <Separator />
          <div className="grid gap-2">
            <p className="text-sm font-medium">Imported runs</p>
            <ImportedDungeonRunsList />
          </div>
        </main>
      </AppLayout>
    </FellowshipDataProvider>
  );
}
