import { CatchBoundary } from "@tanstack/react-router";
import { ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { Suspense } from "react";

import { EmptyState } from "@frt/ui/composites/empty-state.tsx";
import { StatusText } from "@frt/ui/composites/status-text.tsx";
import { Button, buttonVariants } from "@frt/ui/primitives/button.tsx";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@frt/ui/primitives/item.tsx";
import { Skeleton } from "@frt/ui/primitives/skeleton.tsx";

import { useDeleteImportedDungeonRun } from "@/renderer/api/fellowship-logs/fellowship-logs-mutations.ts";
import { useImportedDungeonRunsSuspense } from "@/renderer/api/fellowship-logs/fellowship-logs-queries.ts";
import { logBoundaryError } from "@/renderer/logging/renderer-error-logging.ts";
import { formatRelativeDateTimeFromMilliseconds } from "@/util/format-date-time.ts";

function ImportedDungeonRunsLoadError() {
  return (
    <StatusText variant="destructive">Failed to load imported runs.</StatusText>
  );
}

function ImportedDungeonRunsListSkeleton({
  numRows = 3,
}: {
  numRows?: number;
}) {
  const rowIndexes = Array.from({ length: numRows }, (_, index) => {
    return index;
  });

  return (
    <section
      aria-busy="true"
      aria-label="Loading imported runs"
      aria-live="polite"
    >
      <ItemGroup aria-hidden="true">
        {rowIndexes.map((rowIndex) => (
          <Item key={rowIndex} variant="outline">
            <ItemContent>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </ItemContent>
            <ItemActions>
              <Skeleton className="size-8" />
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </section>
  );
}

function ImportedDungeonRunsListContent() {
  const importedDungeonRuns = useImportedDungeonRunsSuspense();
  const deleteMutation = useDeleteImportedDungeonRun();

  if (importedDungeonRuns.length === 0) {
    return <EmptyState>No Fellowship Logs runs imported yet.</EmptyState>;
  }

  return (
    <ItemGroup>
      {importedDungeonRuns.map((importedDungeonRun) => {
        const fellowshipLogsUrl = `https://www.fellowshiplogs.com/reports/${importedDungeonRun.reportCode}?fight=${importedDungeonRun.fightId}`;

        return (
          <Item key={importedDungeonRun.dungeonRunId} variant="outline">
            <ItemContent>
              <ItemTitle>
                {importedDungeonRun.dungeonName} +
                {importedDungeonRun.dungeonLevel}
              </ItemTitle>
              <ItemDescription>
                Imported&nbsp;
                {formatRelativeDateTimeFromMilliseconds(
                  importedDungeonRun.importedAtMilliseconds,
                )}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <a
                className={buttonVariants({
                  className: "w-fit",
                  shape: "round",
                  variant: "outline",
                })}
                href={fellowshipLogsUrl}
                rel="noopener noreferrer"
                target="_blank"
                title={fellowshipLogsUrl}
              >
                Open in Fellowship Logs
                <ExternalLinkIcon aria-hidden="true" data-icon="inline-end" />
              </a>
              <Button
                aria-label="Delete imported run"
                disabled={
                  deleteMutation.isPending &&
                  deleteMutation.variables?.dungeonRunId ===
                    importedDungeonRun.dungeonRunId
                }
                onClick={() => {
                  deleteMutation.delete({
                    dungeonRunId: importedDungeonRun.dungeonRunId,
                  });
                }}
                size="icon"
                title="Delete imported run"
                type="button"
                variant="destructive"
              >
                <Trash2Icon />
              </Button>
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}

export function ImportedDungeonRunsList() {
  return (
    <CatchBoundary
      errorComponent={ImportedDungeonRunsLoadError}
      getResetKey={() => "imported-dungeon-runs"}
      onCatch={logBoundaryError}
    >
      <Suspense fallback={<ImportedDungeonRunsListSkeleton />}>
        <ImportedDungeonRunsListContent />
      </Suspense>
    </CatchBoundary>
  );
}
