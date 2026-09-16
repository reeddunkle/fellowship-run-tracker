import {
  type ColumnDef,
  columnOrderingFeature,
  columnVisibilityFeature,
  type Table,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import {
  createContext,
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
  useContext,
  useMemo,
} from "react";

import { type DungeonRunComparisonElapsedMilliseconds } from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-milestone-rows.ts";
import { type DungeonRunTableRow as DungeonRunTableRowData } from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-table-row.ts";
import {
  formatDuration,
  formatSignedDuration,
} from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-time.ts";
import { useDungeonRunAppStore } from "@/electron/renderer/stores/app-state-store/use-app-store.ts";
import {
  DUNGEON_RUN_TIME_COLUMN,
  type DungeonRunTimeColumn,
} from "@/electron/storage/app-state/app-state-schema.ts";
import { ReactContextError } from "@/errors/react-context-error.ts";
import { cn } from "@/util/class-names.ts";

const LABEL_COLUMN_ID = "label";

const DungeonRunTableFeatures = tableFeatures({
  columnOrderingFeature,
  columnVisibilityFeature,
});

export const DUNGEON_RUN_TIME_COLUMNS = [
  {
    label: "Best",
    value: DUNGEON_RUN_TIME_COLUMN.BEST_DELTA,
  },
  {
    label: "Average",
    value: DUNGEON_RUN_TIME_COLUMN.AVERAGE_DELTA,
  },
  {
    label: "Median",
    value: DUNGEON_RUN_TIME_COLUMN.MEDIAN_DELTA,
  },
  {
    label: "Goal",
    value: DUNGEON_RUN_TIME_COLUMN.GOAL_DELTA,
  },
  {
    label: "Segment",
    value: DUNGEON_RUN_TIME_COLUMN.SEGMENT,
  },
  {
    label: "Total",
    value: DUNGEON_RUN_TIME_COLUMN.TOTAL,
  },
] as const satisfies ReadonlyArray<{
  readonly label: string;
  readonly value: DungeonRunTimeColumn;
}>;

type DungeonRunTimeColumnDefinition = (typeof DUNGEON_RUN_TIME_COLUMNS)[number];

const columns: Array<
  ColumnDef<typeof DungeonRunTableFeatures, DungeonRunTableRowData>
> = [
  {
    id: LABEL_COLUMN_ID,
  },
  ...A.map(DUNGEON_RUN_TIME_COLUMNS, (timeColumn) => {
    return {
      header: timeColumn.label,
      id: timeColumn.value,
    };
  }),
];

type DungeonRunTableContextValue = {
  readonly table: Table<typeof DungeonRunTableFeatures, DungeonRunTableRowData>;
  readonly visibleTimeColumns: ReadonlyArray<DungeonRunTimeColumnDefinition>;
};

const DungeonRunTableContext =
  createContext<DungeonRunTableContextValue | null>(null);

const TimeColumnDisplayOrder = Order.mapInput(
  Order.Number,
  (timeColumn: { readonly displayOrder: number }) => {
    return timeColumn.displayOrder;
  },
);

export function useDungeonRunTable() {
  const context = useContext(DungeonRunTableContext);

  if (context === null) {
    throw new ReactContextError({
      hookName: "useDungeonRunTable",
      providerName: "DungeonRunTable",
    });
  }

  return context;
}

type DungeonRunTableProps = {
  readonly children: ReactNode;
  readonly rows: Array<DungeonRunTableRowData>;
};

export function DungeonRunTable({ children, rows }: DungeonRunTableProps) {
  const { timeColumns } = useDungeonRunAppStore();

  const orderedTimeColumns = useMemo(() => {
    return pipe(timeColumns, A.sort(TimeColumnDisplayOrder));
  }, [timeColumns]);

  const columnOrder = useMemo(() => {
    return [
      LABEL_COLUMN_ID,
      ...A.map(orderedTimeColumns, (timeColumn) => {
        return timeColumn.column;
      }),
    ];
  }, [orderedTimeColumns]);

  const columnVisibility = useMemo(() => {
    return Object.fromEntries(
      A.map(timeColumns, (timeColumn) => {
        return [timeColumn.column, timeColumn.isVisible] as const;
      }),
    );
  }, [timeColumns]);

  const table = useTable({
    columns,
    data: rows,
    features: DungeonRunTableFeatures,
    state: {
      columnOrder,
      columnVisibility,
    },
  });

  const contextValue = useMemo(() => {
    const visibleTimeColumns = pipe(
      table.getVisibleLeafColumns(),
      A.filter((column) => {
        return column.id !== LABEL_COLUMN_ID;
      }),
      A.map((column) => {
        return A.findFirst(DUNGEON_RUN_TIME_COLUMNS, (timeColumn) => {
          return timeColumn.value === column.id;
        }).pipe(Option.getOrThrow);
      }),
    );

    return {
      table,
      visibleTimeColumns,
    } satisfies DungeonRunTableContextValue;
  }, [table]);

  return (
    <DungeonRunTableContext value={contextValue}>
      <table className="w-full table-fixed border-separate border-spacing-0">
        <colgroup>
          <col data-dungeon-run-label-col="" />
          {A.map(contextValue.visibleTimeColumns, (timeColumn) => {
            return <col key={timeColumn.value} style={{ width: "10ch" }} />;
          })}
        </colgroup>
        {children}
      </table>
    </DungeonRunTableContext>
  );
}

type DungeonRunTableTrProps = HTMLAttributes<HTMLTableRowElement>;

export function DungeonRunTableTr({
  children,
  className,
  ...props
}: DungeonRunTableTrProps) {
  return (
    <tr {...props} className={className}>
      {children}
    </tr>
  );
}

type DungeonRunTableLabelCellProps = TdHTMLAttributes<HTMLTableCellElement>;

export function DungeonRunTableLabelCell({
  children,
  className,
  ...props
}: DungeonRunTableLabelCellProps) {
  return (
    <td
      {...props}
      className={cn("min-w-[10ch] overflow-hidden align-middle", className)}
    >
      <div className="min-w-0 overflow-hidden">{children}</div>
    </td>
  );
}

type DungeonRunTableTimeCellProps = TdHTMLAttributes<HTMLTableCellElement>;

export function DungeonRunTableTimeCell({
  children,
  className,
  ...props
}: DungeonRunTableTimeCellProps) {
  return (
    <td
      {...props}
      className={cn(
        "min-w-[10ch] whitespace-nowrap px-2 text-right align-middle font-mono tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function DungeonRunTableTimeHeaders() {
  const { visibleTimeColumns } = useDungeonRunTable();

  return (
    <>
      {A.map(visibleTimeColumns, (timeColumn) => {
        return (
          <th
            className="min-w-[12ch] whitespace-nowrap px-2 text-right font-normal"
            key={timeColumn.value}
            scope="col"
          >
            {timeColumn.label}
          </th>
        );
      })}
    </>
  );
}

type DungeonRunTableTimeCellsProps = {
  readonly comparisonElapsedMilliseconds: DungeonRunComparisonElapsedMilliseconds;
  readonly segmentMilliseconds: number | undefined;
  readonly totalMilliseconds: number | undefined;
};

export function DungeonRunTableTimeCells({
  comparisonElapsedMilliseconds,
  segmentMilliseconds,
  totalMilliseconds,
}: DungeonRunTableTimeCellsProps) {
  const { visibleTimeColumns } = useDungeonRunTable();

  const getDeltaMilliseconds = (
    comparisonMilliseconds: number | undefined,
  ): number | undefined => {
    if (
      totalMilliseconds === undefined ||
      comparisonMilliseconds === undefined
    ) {
      return undefined;
    }

    return totalMilliseconds - comparisonMilliseconds;
  };

  const deltaMilliseconds = {
    average: getDeltaMilliseconds(comparisonElapsedMilliseconds.average),
    best: getDeltaMilliseconds(comparisonElapsedMilliseconds.best),
    goal: getDeltaMilliseconds(comparisonElapsedMilliseconds.goal),
    median: getDeltaMilliseconds(comparisonElapsedMilliseconds.median),
  };

  const firstActiveTimeColumn = A.findFirst(
    visibleTimeColumns,
    (timeColumn) => {
      return (
        timeColumn.value === DUNGEON_RUN_TIME_COLUMN.SEGMENT ||
        timeColumn.value === DUNGEON_RUN_TIME_COLUMN.TOTAL
      );
    },
  ).pipe(Option.getOrUndefined);

  const renderDeltaCell = (
    timeColumn: DungeonRunTimeColumnDefinition,
    delta: number | undefined,
  ) => {
    return (
      <DungeonRunTableTimeCell
        className={cn({
          "text-red-500": delta !== undefined && delta > 0,
          "text-yellow-500": delta !== undefined && delta < 0,
        })}
        key={timeColumn.value}
      >
        {formatSignedDuration(delta, {
          fractionalDigits: 2,
          includeZeroMinutes: false,
          minimumFractionalDigits: 1,
          padSeconds: false,
        })}
      </DungeonRunTableTimeCell>
    );
  };

  return (
    <>
      {A.map(visibleTimeColumns, (timeColumn) => {
        const isFirstActiveTimeColumn =
          timeColumn.value === firstActiveTimeColumn?.value;

        return Match.value(timeColumn.value).pipe(
          Match.when(DUNGEON_RUN_TIME_COLUMN.BEST_DELTA, () => {
            return renderDeltaCell(timeColumn, deltaMilliseconds.best);
          }),
          Match.when(DUNGEON_RUN_TIME_COLUMN.AVERAGE_DELTA, () => {
            return renderDeltaCell(timeColumn, deltaMilliseconds.average);
          }),
          Match.when(DUNGEON_RUN_TIME_COLUMN.MEDIAN_DELTA, () => {
            return renderDeltaCell(timeColumn, deltaMilliseconds.median);
          }),
          Match.when(DUNGEON_RUN_TIME_COLUMN.GOAL_DELTA, () => {
            return renderDeltaCell(timeColumn, deltaMilliseconds.goal);
          }),
          Match.when(DUNGEON_RUN_TIME_COLUMN.SEGMENT, () => {
            return (
              <DungeonRunTableTimeCell
                className={cn(
                  isFirstActiveTimeColumn && "border-l-2! border-l-border!",
                )}
                key={timeColumn.value}
              >
                {formatDuration(segmentMilliseconds)}
              </DungeonRunTableTimeCell>
            );
          }),
          Match.when(DUNGEON_RUN_TIME_COLUMN.TOTAL, () => {
            return (
              <DungeonRunTableTimeCell
                className={cn(
                  isFirstActiveTimeColumn && "border-l-2! border-l-border!",
                )}
                key={timeColumn.value}
              >
                {formatDuration(totalMilliseconds)}
              </DungeonRunTableTimeCell>
            );
          }),
          Match.exhaustive,
        );
      })}
    </>
  );
}
