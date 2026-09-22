import { CatchBoundary } from "@tanstack/react-router";
import { ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { Suspense } from "react";

import { Button, buttonVariants } from "@frt/ui/button.tsx";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@frt/ui/item.tsx";
import { Skeleton } from "@frt/ui/skeleton.tsx";

import { useDeleteImportedDungeonRun } from "@/renderer/api/fellowship-logs/fellowship-logs-mutations.ts";
import { useImportedDungeonRunsSuspense } from "@/renderer/api/fellowship-logs/fellowship-logs-queries.ts";
import { formatRelativeDateTimeFromMilliseconds } from "@/util/format-date-time.ts";

function ImportedDungeonRunsLoadError() {
  return (
    <p className="text-sm text-destructive">Failed to load imported runs.</p>
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
              <Skeleton className="size-8 rounded-md" />
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
    return (
      <p className="text-sm text-muted-foreground">
        No Fellowship Logs runs imported yet.
      </p>
    );
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
                  className: "w-fit rounded-full flex items-center",
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
    >
      <Suspense fallback={<ImportedDungeonRunsListSkeleton />}>
        <ImportedDungeonRunsListContent />
      </Suspense>
    </CatchBoundary>
  );
}
