import {
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useMemo } from "react";

import { formatDuration } from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-time.ts";
import { type HistoryRequirementComparisonRow } from "@/electron/renderer/components/history/history-requirement-comparison.ts";
import { useFellowshipDataStore } from "@/electron/renderer/stores/fellowship-data/fellowship-data-store.tsx";
import { getRequirementTargetLabel } from "@/helpers/requirement-target-label.ts";
import { type DungeonRunApiObservationStatistics } from "@/services/api/dungeon-run/dungeon-run-api-schema.ts";
import { cn } from "@/util/class-names.ts";

type HistoryComparisonTableProps = {
  readonly rows: ReadonlyArray<HistoryRequirementComparisonRow>;
};

type HistoryComparisonTableRow = HistoryRequirementComparisonRow & {
  readonly targetLabel: string;
};

function StatisticsCell({
  statistics,
}: {
  readonly statistics: DungeonRunApiObservationStatistics | undefined;
}) {
  if (statistics === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="grid gap-0.5">
      <div className="font-medium">
        {formatDuration(statistics.bestElapsedMilliseconds)}
      </div>
      <div className="text-xs text-muted-foreground">
        avg {formatDuration(statistics.meanElapsedMilliseconds)} · median{" "}
        {formatDuration(statistics.medianElapsedMilliseconds)} ·{" "}
        {statistics.sampleCount === 1
          ? "1 sample"
          : `${statistics.sampleCount} samples`}
      </div>
    </div>
  );
}

const historyComparisonTableFeatures = tableFeatures({
  columnMeta: {} as { readonly cellClassName?: string },
});

const columnHelper = createColumnHelper<
  typeof historyComparisonTableFeatures,
  HistoryComparisonTableRow
>();

const columns = columnHelper.columns([
  columnHelper.accessor("milestoneLabel", {
    cell: (info) => info.getValue(),
    header: "Milestone",
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
    header: "Checkpoint",
    id: "checkpoint",
  }),
  columnHelper.display({
    cell: ({ row }) => {
      return <StatisticsCell statistics={row.original.mine} />;
    },
    header: "My best",
    id: "mine",
  }),
  columnHelper.display({
    cell: ({ row }) => {
      return <StatisticsCell statistics={row.original.comparison} />;
    },
    header: "Comparison",
    id: "comparison",
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
                    <th className="px-3 py-2 font-medium" key={header.id}>
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
