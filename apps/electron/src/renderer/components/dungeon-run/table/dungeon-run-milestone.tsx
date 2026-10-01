import * as A from "effect/Array";
import { ChevronRightIcon } from "lucide-react";

import { getRequirementTargetLabel } from "@frt/shared/fellowship/requirements/requirement-target-label.ts";
import {
  TimingTableBody,
  TimingTableLabelCell,
  TimingTableRow,
  TimingTableRowToggle,
} from "@frt/ui/composites/timing-table.tsx";
import { cn } from "@frt/ui/styles/class-names.ts";

import {
  type DungeonRunComparisonElapsedMilliseconds,
  type DungeonRunRequirementRow,
} from "@/renderer/components/dungeon-run/helpers/dungeon-run-milestone-rows.ts";
import { type DungeonRunTableMilestoneRow } from "@/renderer/components/dungeon-run/helpers/dungeon-run-table-row.ts";
import { getObservationComparisonElapsedMilliseconds } from "@/renderer/components/dungeon-run/helpers/dungeon-run-time.ts";
import { DungeonRunTableTimeCells } from "@/renderer/components/dungeon-run/table/dungeon-run-table.tsx";
import { useDungeonRunDisplayState } from "@/renderer/stores/dungeon-run/dungeon-run-provider.tsx";
import { useFellowshipDataStore } from "@/renderer/stores/fellowship-data/fellowship-data-store.tsx";

type DungeonRunMilestoneProps = {
  readonly row: DungeonRunTableMilestoneRow;
};

function RequirementRow({
  requirementRow,
  segmentElapsedMilliseconds,
}: {
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
    <TimingTableRow variant="item">
      <TimingTableLabelCell inset>
        <div className="truncate text-muted-foreground">
          {targetLabel}
          <span className="px-1">·</span>
          {requirementRow.requirement.type}
        </div>
        {requirementRow.requirement.type === "UNIT_DEATH" ? (
          <div className="truncate text-2xs text-muted-foreground/70">
            occurrence {requirementRow.requirement.startOccurrence}
            {requirementRow.requirement.requiredCount > 1 &&
              `–${
                requirementRow.requirement.startOccurrence +
                requirementRow.requirement.requiredCount -
                1
              }`}
          </div>
        ) : null}
      </TimingTableLabelCell>
      <DungeonRunTableTimeCells
        comparisonElapsedMilliseconds={comparisonElapsedMilliseconds}
        segmentMilliseconds={segmentElapsedMilliseconds}
        totalMilliseconds={observation?.elapsedFromStartMilliseconds}
      />
    </TimingTableRow>
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
    <TimingTableBody>
      <TimingTableRow>
        <TimingTableLabelCell>
          <TimingTableRowToggle
            aria-expanded={isOpen}
            onClick={() => {
              setMilestoneExpanded(milestoneKey, !isOpen);
            }}
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
          </TimingTableRowToggle>
        </TimingTableLabelCell>
        <DungeonRunTableTimeCells
          comparisonElapsedMilliseconds={
            milestone.comparisonElapsedMilliseconds
          }
          segmentMilliseconds={milestone.segmentElapsedMilliseconds}
          totalMilliseconds={milestone.elapsedMilliseconds}
        />
      </TimingTableRow>
      {hasExpandedRequirements
        ? A.map(subRows, (requirementTableRow, requirementIndex) => {
            const requirementRow = requirementTableRow.requirementRow;
            return (
              <RequirementRow
                key={`${requirementRow.requirement.type}:${requirementRow.requirement.targetId}:${requirementIndex}`}
                requirementRow={requirementRow}
                segmentElapsedMilliseconds={
                  requirementTableRow.segmentElapsedMilliseconds
                }
              />
            );
          })
        : null}
    </TimingTableBody>
  );
}
