import * as A from "effect/Array";
import { ChevronRightIcon } from "lucide-react";

import {
  type DungeonRunComparisonElapsedMilliseconds,
  type DungeonRunRequirementRow,
} from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-milestone-rows.ts";
import { type DungeonRunTableMilestoneRow } from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-table-row.ts";
import { getObservationComparisonElapsedMilliseconds } from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-time.ts";
import {
  DungeonRunTableLabelCell,
  DungeonRunTableTimeCells,
  DungeonRunTableTr,
} from "@/electron/renderer/components/dungeon-run/table/dungeon-run-table.tsx";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import { useDungeonRunDisplayState } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";
import { useFellowshipDataStore } from "@/electron/renderer/stores/fellowship-data/fellowship-data-store.tsx";
import { getRequirementTargetLabel } from "@/helpers/requirement-target-label.ts";
import { cn } from "@/util/class-names.ts";

type DungeonRunMilestoneProps = {
  readonly row: DungeonRunTableMilestoneRow;
};

function RequirementRow({
  isLast,
  requirementRow,
  segmentElapsedMilliseconds,
}: {
  readonly isLast: boolean;
  readonly requirementRow: DungeonRunRequirementRow;
  readonly segmentElapsedMilliseconds: number | undefined;
}) {
  const abilitiesById = useFellowshipDataStore((state) => state.abilitiesById);
  const dungeonsById = useFellowshipDataStore((state) => state.dungeonsById);
  const encountersById = useFellowshipDataStore(
    (state) => state.encountersById,
  );
  const unitsById = useFellowshipDataStore((state) => state.unitsById);

  const observation = requirementRow.completedObservation;

  const comparisonElapsedMilliseconds: DungeonRunComparisonElapsedMilliseconds =
    {
      average:
        observation === undefined
          ? undefined
          : getObservationComparisonElapsedMilliseconds({
              comparison: "AVERAGE",
              observation,
            }),
      best:
        observation === undefined
          ? undefined
          : getObservationComparisonElapsedMilliseconds({
              comparison: "BEST",
              observation,
            }),
      goal: undefined,
      median:
        observation === undefined
          ? undefined
          : getObservationComparisonElapsedMilliseconds({
              comparison: "MEDIAN",
              observation,
            }),
    };

  const targetLabel = getRequirementTargetLabel({
    abilitiesById,
    dungeonsById,
    encountersById,
    eventType: requirementRow.requirement.type,
    targetId: requirementRow.requirement.targetId,
    unitsById,
  });

  return (
    <DungeonRunTableTr
      className={cn(
        "text-xs [&>td]:border-t [&>td:first-child]:border-l [&>td:last-child]:border-r [&>td:last-child]:pr-3",
        "[&>td+td]:border-l [&>td+td]:border-border/50",
        isLast &&
          "[&>td]:border-b [&>td:first-child]:rounded-bl-md [&>td:last-child]:rounded-br-md",
      )}
    >
      <DungeonRunTableLabelCell className="py-1.5 pr-2 pl-8">
        <div className="truncate text-muted-foreground">
          {targetLabel}
          <span className="px-1">·</span>
          {requirementRow.requirement.type}
        </div>
        {requirementRow.requirement.type === "UNIT_DEATH" ? (
          <div className="truncate text-[10px] text-muted-foreground/70">
            occurrence {requirementRow.requirement.startOccurrence}
            {requirementRow.requirement.requiredCount > 1 &&
              `–${
                requirementRow.requirement.startOccurrence +
                requirementRow.requirement.requiredCount -
                1
              }`}
          </div>
        ) : null}
      </DungeonRunTableLabelCell>
      <DungeonRunTableTimeCells
        comparisonElapsedMilliseconds={comparisonElapsedMilliseconds}
        segmentMilliseconds={segmentElapsedMilliseconds}
        totalMilliseconds={observation?.elapsedFromStartMilliseconds}
      />
    </DungeonRunTableTr>
  );
}

export function DungeonRunMilestone({ row }: DungeonRunMilestoneProps) {
  const { isMilestoneExpanded, setMilestoneExpanded } =
    useDungeonRunDisplayState();

  const { milestone, subRows } = row;

  const milestoneKey = String(milestone.milestoneIndex);
  const isOpen = isMilestoneExpanded(milestoneKey);
  const hasExpandedRequirements = isOpen && subRows.length > 0;

  return (
    <tbody className="bg-card">
      <DungeonRunTableTr
        className={cn(
          "text-sm transition-colors hover:bg-muted/40 dark:hover:bg-muted/20",
          "[&>td]:border-t [&>td:first-child]:border-l [&>td:last-child]:border-r [&>td:last-child]:pr-3",
          "[&>td+td]:border-l [&>td+td]:border-border/50",
          "[&>td:first-child]:rounded-tl-md [&>td:last-child]:rounded-tr-md",
          !hasExpandedRequirements &&
            "[&>td]:border-b [&>td:first-child]:rounded-bl-md [&>td:last-child]:rounded-br-md",
        )}
      >
        <DungeonRunTableLabelCell className="p-0">
          <Button
            aria-expanded={isOpen}
            className="h-full w-full min-w-0 justify-start gap-1.5 rounded-none px-3 py-2 text-left hover:bg-transparent aria-expanded:bg-transparent dark:hover:bg-transparent"
            onClick={() => {
              setMilestoneExpanded(milestoneKey, !isOpen);
            }}
            type="button"
            variant="ghost"
          >
            <ChevronRightIcon
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground transition-transform",
                isOpen && "rotate-90",
              )}
            />
            <span
              className={cn(
                "min-w-0 truncate font-medium",
                !milestone.isCompleted && "text-muted-foreground",
              )}
            >
              {milestone.milestone.label}
            </span>
          </Button>
        </DungeonRunTableLabelCell>
        <DungeonRunTableTimeCells
          comparisonElapsedMilliseconds={
            milestone.comparisonElapsedMilliseconds
          }
          segmentMilliseconds={milestone.segmentElapsedMilliseconds}
          totalMilliseconds={milestone.elapsedMilliseconds}
        />
      </DungeonRunTableTr>
      {hasExpandedRequirements
        ? A.map(subRows, (requirementTableRow, requirementIndex) => {
            const requirementRow = requirementTableRow.requirementRow;
            const isLast = requirementIndex === subRows.length - 1;

            return (
              <RequirementRow
                isLast={isLast}
                key={`${requirementRow.requirement.type}:${requirementRow.requirement.targetId}:${requirementIndex}`}
                requirementRow={requirementRow}
                segmentElapsedMilliseconds={
                  requirementTableRow.segmentElapsedMilliseconds
                }
              />
            );
          })
        : null}
    </tbody>
  );
}
