import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DateTime from "effect/DateTime";
import { Trash2Icon } from "lucide-react";

import { deleteImportedDungeonRunMutationOptions } from "@/electron/renderer/api/fellowship-logs/fellowship-logs-mutations.ts";
import { getFellowshipLogsDungeonRunsQueryOptions } from "@/electron/renderer/api/fellowship-logs/fellowship-logs-queries.ts";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/electron/renderer/components/ui/item.tsx";
import { Spinner } from "@/electron/renderer/components/ui/spinner.tsx";

function formatImportedAt(importedAtMilliseconds: number): string {
  return DateTime.formatLocal(DateTime.makeUnsafe(importedAtMilliseconds), {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ImportedDungeonRunsList() {
  const queryClient = useQueryClient();
  const query = useQuery(getFellowshipLogsDungeonRunsQueryOptions());
  const deleteMutation = useMutation(
    deleteImportedDungeonRunMutationOptions(queryClient),
  );

  if (query.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Loading imported runs...
      </div>
    );
  }

  if (query.isError) {
    return (
      <p className="text-sm text-destructive">Failed to load imported runs.</p>
    );
  }

  if (query.data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Fellowship Logs runs imported yet.
      </p>
    );
  }

  return (
    <ItemGroup>
      {query.data.map((importedDungeonRun) => {
        return (
          <Item key={importedDungeonRun.dungeonRunId} variant="outline">
            <ItemContent>
              <ItemTitle>
                {importedDungeonRun.dungeonName} +
                {importedDungeonRun.dungeonLevel}
              </ItemTitle>
              <ItemDescription>
                {importedDungeonRun.reportCode} / {importedDungeonRun.fightId}{" "}
                &middot; imported{" "}
                {formatImportedAt(importedDungeonRun.importedAtMilliseconds)}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                aria-label="Delete imported run"
                disabled={
                  deleteMutation.isPending &&
                  deleteMutation.variables?.dungeonRunId ===
                    importedDungeonRun.dungeonRunId
                }
                onClick={() => {
                  deleteMutation.mutate({
                    dungeonRunId: importedDungeonRun.dungeonRunId,
                  });
                }}
                size="icon-sm"
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
