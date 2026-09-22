import {
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useMemo } from "react";

import { type DungeonRunApiObservationStatistics } from "@frt/shared/dungeon-run/dungeon-run-api-schema.ts";
import { getRequirementTargetLabel } from "@frt/shared/fellowship/requirements/requirement-target-label.ts";
import { cn } from "@frt/ui/class-names.ts";
import { Skeleton } from "@frt/ui/skeleton.tsx";

import { formatDuration } from "@/renderer/components/dungeon-run/helpers/dungeon-run-time.ts";
import { type HistoryRequirementComparisonRow } from "@/renderer/components/history/history-requirement-comparison.ts";
import { useFellowshipDataStore } from "@/renderer/stores/fellowship-data/fellowship-data-store.tsx";

type HistoryComparisonTableProps = {
  readonly rows: ReadonlyArray<HistoryRequirementComparisonRow>;
};

type HistoryComparisonTableRow = HistoryRequirementComparisonRow & {
  readonly targetLabel: string;
};

const comparisonColumnLabels = {
  checkpoint: "Checkpoint",
  comparison: "Others",
  milestone: "Milestone",
  mine: "Mine",
} as const;

function StatisticsCell({
  statistics,
}: {
  readonly statistics: DungeonRunApiObservationStatistics | undefined;
}) {
  if (statistics === undefined) {
    return <span className="block text-center text-muted-foreground">—</span>;
  }

  return (
    <div className="grid gap-1">
      <table className="w-full border-separate border-spacing-x-3 text-right text-xs">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="font-normal">Best</th>
            <th className="font-normal">Avg</th>
            <th className="font-normal">Median</th>
            <th className="font-normal">Samples</th>
          </tr>
        </thead>
        <tbody>
          <tr className="font-medium">
            <td>{formatDuration(statistics.bestElapsedMilliseconds)}</td>
            <td>{formatDuration(statistics.meanElapsedMilliseconds)}</td>
            <td>{formatDuration(statistics.medianElapsedMilliseconds)}</td>
            <td>{statistics.sampleCount}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const historyComparisonTableFeatures = tableFeatures({
  columnMeta: {} as {
    readonly cellClassName?: string;
    readonly headerClassName?: string;
  },
});

const columnHelper = createColumnHelper<
  typeof historyComparisonTableFeatures,
  HistoryComparisonTableRow
>();

const columns = columnHelper.columns([
  columnHelper.accessor("milestoneLabel", {
    cell: (info) => info.getValue(),
    header: comparisonColumnLabels.milestone,
    meta: { cellClassName: "text-muted-foreground" },
  }),
  columnHelper.display({
    cell: ({ row }) => {
      return (
        <>
          {row.original.targetLabel}
          <span className="px-1 text-muted-foreground">·</span>
          <span className="text-muted-foreground">{row.original.type}</span>
        </>
      );
    },
    header: comparisonColumnLabels.checkpoint,
    id: "checkpoint",
  }),
  columnHelper.display({
    cell: ({ row }) => {
      return <StatisticsCell statistics={row.original.mine} />;
    },
    header: comparisonColumnLabels.mine,
    id: "mine",
    meta: { headerClassName: "text-center" },
  }),
  columnHelper.display({
    cell: ({ row }) => {
      return <StatisticsCell statistics={row.original.comparison} />;
    },
    header: comparisonColumnLabels.comparison,
    id: "comparison",
    meta: { headerClassName: "text-center" },
  }),
]);

export function HistoryComparisonTable({ rows }: HistoryComparisonTableProps) {
  const abilitiesById = useFellowshipDataStore((state) => state.abilitiesById);
  const dungeonsById = useFellowshipDataStore((state) => state.dungeonsById);
  const encountersById = useFellowshipDataStore(
    (state) => state.encountersById,
  );
  const unitsById = useFellowshipDataStore((state) => state.unitsById);

  const data = useMemo<ReadonlyArray<HistoryComparisonTableRow>>(() => {
    return rows.map((row) => {
      return {
        ...row,
        targetLabel: getRequirementTargetLabel({
          abilitiesById,
          dungeonsById,
          encountersById,
          eventType: row.type,
          targetId: row.targetId,
          unitsById,
        }),
      };
    });
  }, [abilitiesById, dungeonsById, encountersById, rows, unitsById]);

  const table = useTable({
    columns,
    data,
    features: historyComparisonTableFeatures,
    getRowId: (row) => row.key,
  });

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => {
            return (
              <tr
                className="border-b bg-muted/50 text-left text-xs text-muted-foreground"
                key={headerGroup.id}
              >
                {headerGroup.headers.map((header) => {
                  return (
                    <th
                      className={cn(
                        "px-3 py-2 font-medium",
                        header.column.columnDef.meta?.headerClassName,
                      )}
                      key={header.id}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  );
                })}
              </tr>
            );
          })}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            return (
              <tr className="border-b last:border-b-0" key={row.id}>
                {row.getAllCells().map((cell) => {
                  return (
                    <td
                      className={cn(
                        "px-3 py-2 align-top",
                        cell.column.columnDef.meta?.cellClassName,
                      )}
                      key={cell.id}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function HistoryComparisonTableSkeleton({
  rows,
}: HistoryComparisonTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            {[
              comparisonColumnLabels.milestone,
              comparisonColumnLabels.checkpoint,
              comparisonColumnLabels.mine,
              comparisonColumnLabels.comparison,
            ].map((label) => (
              <th
                className={cn(
                  "px-3 py-2 font-medium",
                  label === comparisonColumnLabels.mine ||
                    label === comparisonColumnLabels.comparison
                    ? "text-center"
                    : undefined,
                )}
                key={label}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b last:border-b-0" key={row.key}>
              <td className="px-3 py-2 align-top text-muted-foreground">
                {row.milestoneLabel}
              </td>
              <td className="px-3 py-2 align-top">
                <Skeleton className="h-4 w-28" />
              </td>
              {["mine", "comparison"].map((group) => (
                <td className="px-3 py-2 align-top" key={group}>
                  <div className="grid gap-1">
                    <div className="grid grid-cols-3 gap-3">
                      {["best", "avg", "median"].map((statistic) => (
                        <div className="grid gap-1" key={statistic}>
                          <Skeleton className="h-3 w-10" />
                          <Skeleton className="h-4 w-12" />
                        </div>
                      ))}
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
