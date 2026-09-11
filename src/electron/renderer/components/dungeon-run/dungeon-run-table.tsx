import * as A from "effect/Array";
import * as Match from "effect/Match";
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
import { useDungeonRunDisplayState } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";
import {
  DUNGEON_RUN_TIME_COLUMN,
  type DungeonRunTimeColumn,
} from "@/electron/storage/app-state/app-state-schema.ts";
import { ReactContextError } from "@/errors/react-context-error.ts";
import { cn } from "@/util/class-names.ts";

const TIME_COLUMN_WIDTH = "4.25rem";

export const DUNGEON_RUN_TIME_COLUMNS = [
  {
    label: "Delta",
    value: DUNGEON_RUN_TIME_COLUMN.DELTA,
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

type DungeonRunTableContextValue = {
  readonly gridTemplateColumns: string;
  readonly visibleTimeColumns: ReadonlyArray<DungeonRunTimeColumnDefinition>;
};

const DungeonRunTableContext =
  createContext<DungeonRunTableContextValue | null>(null);

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
  const { visibleTimeColumns } = useDungeonRunDisplayState();

  const contextValue = useMemo(() => {
    const visibleColumns = A.filter(DUNGEON_RUN_TIME_COLUMNS, (column) => {
      return visibleTimeColumns.has(column.value);
    });

    const gridTemplateColumns = [
      "minmax(0, 1fr)",
      ...A.map(visibleColumns, (column) => {
        return column.width;
      }),
    ].join(" ");

    return {
      gridTemplateColumns,
      visibleTimeColumns: visibleColumns,
    } satisfies DungeonRunTableContextValue;
  }, [visibleTimeColumns]);

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
  readonly comparisonElapsedMilliseconds: number | undefined;
  readonly segmentMilliseconds: number | undefined;
  readonly totalMilliseconds: number | undefined;
};

export function DungeonRunTableTimeCells({
  comparisonElapsedMilliseconds,
  segmentMilliseconds,
  totalMilliseconds,
}: DungeonRunTableTimeCellsProps) {
  const { visibleTimeColumns } = useDungeonRunTable();

  const deltaMilliseconds =
    totalMilliseconds === undefined ||
    comparisonElapsedMilliseconds === undefined
      ? undefined
      : totalMilliseconds - comparisonElapsedMilliseconds;

  return (
    <>
      {A.map(visibleTimeColumns, (column) => {
        return Match.value(column.value).pipe(
          Match.when(DUNGEON_RUN_TIME_COLUMN.DELTA, () => {
            return (
              <DungeonRunTableTimeCell
                className={cn({
                  "text-red-500":
                    deltaMilliseconds !== undefined && deltaMilliseconds > 0,
                  "text-yellow-500":
                    deltaMilliseconds !== undefined && deltaMilliseconds < 0,
                })}
                key={column.value}
              >
                {formatSignedDuration(deltaMilliseconds, {
                  fractionalDigits: 2,
                  includeZeroMinutes: false,
                  minimumFractionalDigits: 1,
                  padSeconds: false,
                })}
              </DungeonRunTableTimeCell>
            );
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
