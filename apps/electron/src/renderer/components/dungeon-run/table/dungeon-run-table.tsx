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
import { createContext, type ReactNode, useContext, useMemo } from "react";

import {
  DUNGEON_RUN_TIME_COLUMN,
  type DungeonRunTimeColumn,
} from "@frt/shared/app-state/app-state-schema.ts";
import { SplitDelta } from "@frt/ui/composites/split-delta.tsx";
import {
  TimingTable,
  TimingTableLabelColumn,
  TimingTableTimeCell,
  TimingTableTimeColumn,
  TimingTableTimeHead,
} from "@frt/ui/composites/timing-table.tsx";
import { ReactContextError } from "@frt/ui/errors/react-context-error.ts";

import { useDungeonRunTimeColumns } from "@/renderer/api/app-state/app-state-queries.ts";
import { type DungeonRunComparisonElapsedMilliseconds } from "@/renderer/components/dungeon-run/helpers/dungeon-run-milestone-rows.ts";
import { type DungeonRunTableRow as DungeonRunTableRowData } from "@/renderer/components/dungeon-run/helpers/dungeon-run-table-row.ts";
import {
  formatDuration,
  formatSignedDuration,
} from "@/renderer/components/dungeon-run/helpers/dungeon-run-time.ts";

const LABEL_COLUMN_ID = "label";

const DungeonRunTableFeatures = tableFeatures({
  columnOrderingFeature,
  columnVisibilityFeature,
});

const DUNGEON_RUN_TIME_COLUMNS = [
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

function useDungeonRunTable() {
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
  const timeColumns = useDungeonRunTimeColumns();

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
      <TimingTable>
        <colgroup>
          <TimingTableLabelColumn data-dungeon-run-label-col="" />
          {A.map(contextValue.visibleTimeColumns, (timeColumn) => {
            return <TimingTableTimeColumn key={timeColumn.value} />;
          })}
        </colgroup>
        {children}
      </TimingTable>
    </DungeonRunTableContext>
  );
}

export function DungeonRunTableTimeHeaders() {
  const { visibleTimeColumns } = useDungeonRunTable();

  return (
    <>
      {A.map(visibleTimeColumns, (timeColumn) => {
        return (
          <TimingTableTimeHead key={timeColumn.value}>
            {timeColumn.label}
          </TimingTableTimeHead>
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

function getSplitDeltaStatus(
  delta: number | undefined,
): "ahead" | "behind" | undefined {
  if (delta === undefined || delta === 0) {
    return undefined;
  }

  return delta > 0 ? "behind" : "ahead";
}

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
      <TimingTableTimeCell key={timeColumn.value}>
        <SplitDelta status={getSplitDeltaStatus(delta)}>
          {formatSignedDuration(delta, {
            fractionalDigits: 2,
            includeZeroMinutes: false,
            minimumFractionalDigits: 1,
            padSeconds: false,
          })}
        </SplitDelta>
      </TimingTableTimeCell>
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
              <TimingTableTimeCell
                divider={isFirstActiveTimeColumn}
                key={timeColumn.value}
              >
                {formatDuration(segmentMilliseconds)}
              </TimingTableTimeCell>
            );
          }),
          Match.when(DUNGEON_RUN_TIME_COLUMN.TOTAL, () => {
            return (
              <TimingTableTimeCell
                divider={isFirstActiveTimeColumn}
                key={timeColumn.value}
              >
                {formatDuration(totalMilliseconds)}
              </TimingTableTimeCell>
            );
          }),
          Match.exhaustive,
        );
      })}
    </>
  );
}
