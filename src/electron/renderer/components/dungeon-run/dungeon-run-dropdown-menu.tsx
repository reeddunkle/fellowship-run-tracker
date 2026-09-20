import * as A from "effect/Array";
import { MenuIcon } from "lucide-react";
import { useState } from "react";

import { useDetachedWindow } from "@/electron/renderer/components/detached-window/detached-window-provider";
import { useDungeonRunTimeColumnsForm } from "@/electron/renderer/components/dungeon-run/dungeon-run-time-columns-form.ts";
import { DUNGEON_RUN_COMPARISON_GROUP_OPTIONS } from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-comparison-group.ts";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/electron/renderer/components/ui/dropdown-menu.tsx";
import { Field, FieldLabel } from "@/electron/renderer/components/ui/field.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/electron/renderer/components/ui/native-select.tsx";
import { useDungeonRunAppStore } from "@/electron/renderer/stores/app-state-store/use-app-store.ts";
import { type DungeonRunTimeColumn } from "@/electron/storage/app-state/app-state-schema.ts";
import { type DungeonRunApiComparisonGroup } from "@/services/api/dungeon-run/dungeon-run-api-schema.ts";

const TIME_COLUMN_LABELS: Record<DungeonRunTimeColumn, string> = {
  AVERAGE_DELTA: "Average",
  BEST_DELTA: "Best",
  GOAL_DELTA: "Goal",
  MEDIAN_DELTA: "Median",
  SEGMENT: "Segment",
  TOTAL: "Total",
};

const TIME_COLUMNS_FORM_DOM_ID = "dungeon-run-time-columns-form";

export function DungeonRunDropdownMenu() {
  const { portalContainer, resizeToContent } = useDetachedWindow();
  const { comparisonGroup, setComparisonGroup, setTimeColumns, timeColumns } =
    useDungeonRunAppStore();

  const [isOpen, setIsOpen] = useState(false);

  const form = useDungeonRunTimeColumnsForm({
    defaultValues: { timeColumns },
    onApply: (value) => {
      setTimeColumns(value.timeColumns);
      resizeToContent();
      setIsOpen(false);
    },
  });

  return (
    <DropdownMenu
      modal={false}
      onOpenChange={(open) => {
        setIsOpen(open);

        if (!open) {
          void form.handleSubmit();
        }
      }}
      open={isOpen}
    >
      <DropdownMenuTrigger
        render={
          <Button size="icon" variant="outline">
            <MenuIcon />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="min-w-72 border bg-popover p-6 shadow-2xl ring-1 ring-foreground/15 dark:bg-muted rounded-2xl"
        container={portalContainer}
      >
        <section className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="dungeon-run-comparison-group">
              Compare against
            </FieldLabel>
            <NativeSelect
              id="dungeon-run-comparison-group"
              onChange={(event) => {
                setComparisonGroup(
                  event.target.value as DungeonRunApiComparisonGroup,
                );
              }}
              value={comparisonGroup}
            >
              {A.map(DUNGEON_RUN_COMPARISON_GROUP_OPTIONS, (option) => {
                return (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                );
              })}
            </NativeSelect>
          </Field>
          <form
            className="grid gap-2"
            id={TIME_COLUMNS_FORM_DOM_ID}
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();

              void form.handleSubmit();
            }}
          >
            <div className="text-sm font-medium">Select time columns:</div>
            <div className="grid grid-cols-3 gap-1.5">
              {A.map(timeColumns, (timeColumn, index) => {
                return (
                  <form.Field
                    key={timeColumn.column}
                    name={`timeColumns[${index}].isVisible`}
                  >
                    {(field) => {
                      return (
                        <Button
                          aria-pressed={field.state.value}
                          onClick={() => {
                            field.handleChange(!field.state.value);
                          }}
                          size="sm"
                          type="button"
                          variant={field.state.value ? "secondary" : "outline"}
                        >
                          {TIME_COLUMN_LABELS[timeColumn.column]}
                        </Button>
                      );
                    }}
                  </form.Field>
                );
              })}
            </div>
            <Button
              className="justify-self-end"
              form={TIME_COLUMNS_FORM_DOM_ID}
              size="sm"
              type="submit"
            >
              Apply
            </Button>
          </form>
        </section>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
