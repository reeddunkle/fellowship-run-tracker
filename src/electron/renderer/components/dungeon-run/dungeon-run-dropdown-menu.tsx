import * as A from "effect/Array";

import { useDetachedWindow } from "@/electron/renderer/components/detached-window/detached-window-provider";
import { Checkbox } from "@/electron/renderer/components/ui/checkbox.tsx";
import { DropdownMenuContent } from "@/electron/renderer/components/ui/dropdown-menu.tsx";
import { Label } from "@/electron/renderer/components/ui/label.tsx";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/electron/renderer/components/ui/radio-group.tsx";
import { Separator } from "@/electron/renderer/components/ui/separator.tsx";
import {
  COMPARISON_OPTIONS,
  type DungeonRunComparison,
} from "@/electron/renderer/constants/comparison-options.ts";
import { useDungeonRunDisplayState } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";
import {
  DUNGEON_RUN_TIME_COLUMN,
  type DungeonRunTimeColumn,
} from "@/electron/storage/app-state/app-state-schema.ts";
import { cn } from "@/util/class-names.ts";

const activeComparisonOptions = A.filter(
  COMPARISON_OPTIONS,
  ({ value }) => value !== "LAST_RUN",
);

const TIME_COLUMN_OPTIONS = [
  {
    label: "Delta",
    value: DUNGEON_RUN_TIME_COLUMN.DELTA,
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

  const {
    comparison,
    setComparison,
    setTimeColumnVisible,
    visibleTimeColumns,
  } = useDungeonRunDisplayState();

  return (
    <DropdownMenuContent
      align="end"
      className="min-w-72 border bg-popover p-6 shadow-2xl ring-1 ring-foreground/15 dark:bg-muted rounded-2xl"
      container={portalContainer}
    >
      <div className="grid gap-3">
        <section className="grid gap-2">
          <div className="text-sm font-medium">Select comparison:</div>
          <RadioGroup
            className="flex items-center gap-1.5"
            onValueChange={(value) => {
              setComparison(value as DungeonRunComparison);
            }}
            value={comparison}
          >
            {A.map(activeComparisonOptions, (option) => {
              const isSelected = comparison === option.value;

              return (
                <Label
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition",
                    "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    isSelected &&
                      "translate-y-px border-foreground bg-muted text-foreground shadow-inner",
                  )}
                  htmlFor={`comparison-${option.value}`}
                  key={option.value}
                >
                  <RadioGroupItem
                    className="size-4"
                    id={`comparison-${option.value}`}
                    value={option.value}
                  />

                  <span className="whitespace-nowrap">{option.label}</span>
                </Label>
              );
            })}
          </RadioGroup>
        </section>

        <Separator />

        <section className="grid gap-2">
          <div className="text-sm font-medium">Select time columns:</div>
          <div className="grid gap-1.5">
            {A.map(TIME_COLUMN_OPTIONS, (option) => {
              const isVisible = visibleTimeColumns.has(option.value);

              return (
                <Label
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  htmlFor={`time-column-${option.value}`}
                  key={option.value}
                >
                  <Checkbox
                    checked={isVisible}
                    id={`time-column-${option.value}`}
                    onCheckedChange={(checked) => {
                      setTimeColumnVisible(option.value, checked === true);
                    }}
                  />
                  <span>{option.label}</span>
                </Label>
              );
            })}
          </div>
        </section>
      </div>
    </DropdownMenuContent>
  );
}
