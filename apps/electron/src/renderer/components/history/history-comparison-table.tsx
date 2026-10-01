import {
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useMemo } from "react";

import { type DungeonRunApiObservationStatistics } from "@frt/shared/dungeon-run/dungeon-run-api-schema.ts";
import { getRequirementTargetLabel } from "@frt/shared/fellowship/requirements/requirement-target-label.ts";
import { Skeleton } from "@frt/ui/primitives/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frt/ui/primitives/table.tsx";

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
    readonly align?: "center" | "end" | "start";
    readonly variant?: "default" | "muted";
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
    meta: { variant: "muted" },
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
    meta: { align: "center" },
  }),
  columnHelper.display({
    cell: ({ row }) => {
      return <StatisticsCell statistics={row.original.comparison} />;
    },
    header: comparisonColumnLabels.comparison,
    id: "comparison",
    meta: { align: "center" },
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
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => {
          return (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead
                    align={header.column.columnDef.meta?.align}
                    key={header.id}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          );
        })}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => {
          return (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => {
                return (
                  <TableCell
                    align={cell.column.columnDef.meta?.align}
                    key={cell.id}
                    variant={cell.column.columnDef.meta?.variant}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function HistoryComparisonTableSkeleton({
  rows,
}: HistoryComparisonTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{comparisonColumnLabels.milestone}</TableHead>
          <TableHead>{comparisonColumnLabels.checkpoint}</TableHead>
          <TableHead align="center">{comparisonColumnLabels.mine}</TableHead>
          <TableHead align="center">
            {comparisonColumnLabels.comparison}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell variant="muted">{row.milestoneLabel}</TableCell>
            <TableCell>
              <Skeleton className="h-4 w-28" />
            </TableCell>
            {["mine", "comparison"].map((group) => (
              <TableCell key={group}>
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
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
