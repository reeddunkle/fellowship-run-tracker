import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  createContext,
  type ReactNode,
  type Ref,
  useContext,
  useMemo,
} from "react";

import {
  formatDuration,
  formatSignedDuration,
} from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-time";
import { useDungeonRunAppStore } from "@/electron/renderer/stores/app-state-store/use-app-store.ts";
import {
  DUNGEON_RUN_TIME_COLUMN,
  type DungeonRunTimeColumn,
} from "@/electron/storage/app-state/app-state-schema.ts";
import { ReactContextError } from "@/errors/react-context-error.ts";
import { cn } from "@/util/class-names.ts";

const TIME_COLUMN_WIDTH = "4.25rem";

export const DUNGEON_RUN_TIME_COLUMNS = [
  {
    label: "Best",
    value: DUNGEON_RUN_TIME_COLUMN.BEST_DELTA,
    width: TIME_COLUMN_WIDTH,
  },
  {
    label: "Average",
    value: DUNGEON_RUN_TIME_COLUMN.AVERAGE_DELTA,
    width: TIME_COLUMN_WIDTH,
  },
  {
    label: "Median",
    value: DUNGEON_RUN_TIME_COLUMN.MEDIAN_DELTA,
    width: TIME_COLUMN_WIDTH,
  },
  {
    label: "Goal",
    value: DUNGEON_RUN_TIME_COLUMN.GOAL_DELTA,
    width: TIME_COLUMN_WIDTH,
  },
  {
    label: "Segment",
    value: DUNGEON_RUN_TIME_COLUMN.SEGMENT,
    width: TIME_COLUMN_WIDTH,
  },
  {
    label: "Total",
    value: DUNGEON_RUN_TIME_COLUMN.TOTAL,
    width: TIME_COLUMN_WIDTH,
  },
] as const satisfies ReadonlyArray<{
  readonly label: string;
  readonly value: DungeonRunTimeColumn;
  readonly width: string;
}>;

type DungeonRunTimeColumnDefinition = (typeof DUNGEON_RUN_TIME_COLUMNS)[number];

type DungeonRunComparisonElapsedMilliseconds = {
  readonly average: number | undefined;
  readonly best: number | undefined;
  readonly goal: number | undefined;
  readonly median: number | undefined;
};

type DungeonRunTableContextValue = {
  readonly gridTemplateColumns: string;
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
};

export function DungeonRunTable({ children }: DungeonRunTableProps) {
  const { timeColumns } = useDungeonRunAppStore();

  const contextValue = useMemo(() => {
    const visibleTimeColumns = pipe(
      timeColumns,
      A.filter((timeColumn) => {
        return timeColumn.isVisible;
      }),
      A.sort(TimeColumnDisplayOrder),
      A.map((timeColumn) => {
        return A.findFirst(
          DUNGEON_RUN_TIME_COLUMNS,
          (column) => column.value === timeColumn.column,
        ).pipe(Option.getOrThrow);
      }),
    );

    const gridTemplateColumns = [
      "minmax(0, 1fr)",
      ...A.map(visibleTimeColumns, (column) => {
        return column.width;
      }),
    ].join(" ");

    return {
      gridTemplateColumns,
      visibleTimeColumns,
    } satisfies DungeonRunTableContextValue;
  }, [timeColumns]);

  return (
    <DungeonRunTableContext value={contextValue}>
      {children}
    </DungeonRunTableContext>
  );
}

type DungeonRunTableRowProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export function DungeonRunTableRow({
  children,
  className,
}: DungeonRunTableRowProps) {
  const { gridTemplateColumns } = useDungeonRunTable();

  const style = {
    gridTemplateColumns,
  } satisfies CSSProperties;

  return (
    <div className={cn("grid min-w-0 gap-x-2", className)} style={style}>
      {children}
    </div>
  );
}

type DungeonRunTableTriggerRowProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    readonly ref?: Ref<HTMLButtonElement>;
  };

export function DungeonRunTableTriggerRow({
  children,
  className,
  ref,
  style,
  ...props
}: DungeonRunTableTriggerRowProps) {
  const { gridTemplateColumns } = useDungeonRunTable();

  return (
    <button
      {...props}
      className={cn("grid min-w-0 gap-x-2", className)}
      ref={ref}
      style={{
        ...style,
        gridTemplateColumns,
      }}
    >
      {children}
    </button>
  );
}

type DungeonRunTableLabelCellProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export function DungeonRunTableLabelCell({
  children,
  className,
}: DungeonRunTableLabelCellProps) {
  return (
    <div className={cn("min-w-0 overflow-hidden", className)}>{children}</div>
  );
}

type DungeonRunTableTimeCellProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export function DungeonRunTableTimeCell({
  children,
  className,
}: DungeonRunTableTimeCellProps) {
  return (
    <div className={cn("min-w-0 text-right font-mono tabular-nums", className)}>
      {children}
    </div>
  );
}

export function DungeonRunTableTimeHeaders() {
  const { visibleTimeColumns } = useDungeonRunTable();

  return (
    <>
      {A.map(visibleTimeColumns, (column) => {
        return (
          <div className="text-right" key={column.value}>
            {column.label}
          </div>
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

  const renderDeltaCell = (
    column: DungeonRunTimeColumnDefinition,
    delta: number | undefined,
  ) => {
    return (
      <DungeonRunTableTimeCell
        className={cn({
          "text-red-500": delta !== undefined && delta > 0,
          "text-yellow-500": delta !== undefined && delta < 0,
        })}
        key={column.value}
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
      {A.map(visibleTimeColumns, (column) => {
        return Match.value(column.value).pipe(
          Match.when(DUNGEON_RUN_TIME_COLUMN.BEST_DELTA, () => {
            return renderDeltaCell(column, deltaMilliseconds.best);
          }),
          Match.when(DUNGEON_RUN_TIME_COLUMN.AVERAGE_DELTA, () => {
            return renderDeltaCell(column, deltaMilliseconds.average);
          }),
          Match.when(DUNGEON_RUN_TIME_COLUMN.MEDIAN_DELTA, () => {
            return renderDeltaCell(column, deltaMilliseconds.median);
          }),
          Match.when(DUNGEON_RUN_TIME_COLUMN.GOAL_DELTA, () => {
            return renderDeltaCell(column, deltaMilliseconds.goal);
          }),
          Match.when(DUNGEON_RUN_TIME_COLUMN.SEGMENT, () => {
            return (
              <DungeonRunTableTimeCell key={column.value}>
                {formatDuration(segmentMilliseconds)}
              </DungeonRunTableTimeCell>
            );
          }),
          Match.when(DUNGEON_RUN_TIME_COLUMN.TOTAL, () => {
            return (
              <DungeonRunTableTimeCell key={column.value}>
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
