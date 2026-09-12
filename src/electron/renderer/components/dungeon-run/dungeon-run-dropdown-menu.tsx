import * as A from "effect/Array";
import * as Option from "effect/Option";

import { useDetachedWindow } from "@/electron/renderer/components/detached-window/detached-window-provider";
import { Checkbox } from "@/electron/renderer/components/ui/checkbox.tsx";
import { DropdownMenuContent } from "@/electron/renderer/components/ui/dropdown-menu.tsx";
import { Label } from "@/electron/renderer/components/ui/label.tsx";
import { useDungeonRunAppStore } from "@/electron/renderer/stores/app-state-store/use-app-store.ts";
import {
  DUNGEON_RUN_TIME_COLUMN,
  type DungeonRunTimeColumn,
} from "@/electron/storage/app-state/app-state-schema.ts";

const TIME_COLUMN_OPTIONS = [
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

export function DungeonRunDropdownMenu() {
  const { portalContainer } = useDetachedWindow();
  const { setTimeColumns, timeColumns } = useDungeonRunAppStore();

  const renderOption = (option: (typeof TIME_COLUMN_OPTIONS)[number]) => {
    const columnState = A.findFirst(
      timeColumns,
      (timeColumn) => timeColumn.column === option.value,
    );

    const isVisible = Option.match(columnState, {
      onNone: () => false,
      onSome: (timeColumn) => timeColumn.isVisible,
    });

    return (
      <Label
        className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-sm hover:bg-accent"
        htmlFor={`time-column-${option.value}`}
        key={option.value}
      >
        <Checkbox
          checked={isVisible}
          id={`time-column-${option.value}`}
          onCheckedChange={(checked) => {
            const nextTimeColumns = A.map(timeColumns, (timeColumn) => {
              if (timeColumn.column !== option.value) {
                return timeColumn;
              }

              return {
                ...timeColumn,
                isVisible: checked === true,
              };
            });

            setTimeColumns(nextTimeColumns);
          }}
        />
        <span>{option.label}</span>
      </Label>
    );
  };

  return (
    <DropdownMenuContent
      align="end"
      className="min-w-72 border bg-popover p-6 shadow-2xl ring-1 ring-foreground/15 dark:bg-muted rounded-2xl"
      container={portalContainer}
    >
      <section className="grid gap-2">
        <div className="text-sm font-medium">Select time columns:</div>

        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {A.map(
              A.filter(TIME_COLUMN_OPTIONS, (option) => {
                return (
                  option.value !== DUNGEON_RUN_TIME_COLUMN.SEGMENT &&
                  option.value !== DUNGEON_RUN_TIME_COLUMN.TOTAL
                );
              }),
              renderOption,
            )}
          </div>
          <div className="flex items-center gap-2">
            {A.map(
              A.filter(TIME_COLUMN_OPTIONS, (option) => {
                return (
                  option.value === DUNGEON_RUN_TIME_COLUMN.SEGMENT ||
                  option.value === DUNGEON_RUN_TIME_COLUMN.TOTAL
                );
              }),
              renderOption,
            )}
          </div>
        </div>
      </section>
    </DropdownMenuContent>
  );
}
