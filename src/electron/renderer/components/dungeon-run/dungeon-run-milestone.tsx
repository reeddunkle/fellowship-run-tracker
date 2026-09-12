import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as Predicate from "effect/Predicate";
import { ChevronRightIcon } from "lucide-react";

import {
  DungeonRunTableLabelCell,
  DungeonRunTableRow,
  DungeonRunTableTimeCells,
  DungeonRunTableTriggerRow,
} from "@/electron/renderer/components/dungeon-run/dungeon-run-table.tsx";
import { getObservationComparisonElapsedMilliseconds } from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-time.ts";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/electron/renderer/components/ui/collapsible.tsx";
import {
  type DungeonRunObservationInterpretation,
  useDungeonRunDisplayState,
} from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";
import { useFellowshipDataStore } from "@/electron/renderer/stores/fellowship-data/fellowship-data-store.tsx";
import { getRequirementTargetLabel } from "@/helpers/requirement-target-label.ts";
import { type ConfigurationApiConfiguration } from "@/services/api/configuration/configuration-api-schema.ts";
import { cn } from "@/util/class-names.ts";

type Milestone = ConfigurationApiConfiguration["milestones"][number];

type Requirement = Milestone["requirements"][number];

export type DungeonRunComparisonElapsedMilliseconds = {
  readonly average: number | undefined;
  readonly best: number | undefined;
  readonly goal: number | undefined;
  readonly median: number | undefined;
};

export type DungeonRunRequirementRow = {
  readonly completedObservation:
    | DungeonRunObservationInterpretation
    | undefined;
  readonly matchingObservations: ReadonlyArray<DungeonRunObservationInterpretation>;
  readonly requirement: Requirement;
};

export type DungeonRunMilestoneRow = {
  readonly comparisonElapsedMilliseconds: DungeonRunComparisonElapsedMilliseconds;
  readonly completedAtMilliseconds: number | undefined;
  readonly elapsedMilliseconds: number | undefined;
  readonly isCompleted: boolean;
  readonly milestone: Milestone;
  readonly milestoneIndex: number;
  readonly requirementRows: ReadonlyArray<DungeonRunRequirementRow>;
  readonly segmentElapsedMilliseconds: number | undefined;
  readonly segmentStartedAtMilliseconds: number | undefined;
};

type DungeonRunMilestoneProps = {
  readonly milestone: DungeonRunMilestoneRow;
};

const UndefinedLastNumberOrder = Order.make<number | undefined>(
  (left, right) => {
    if (left === undefined && right === undefined) {
      return 0;
    }

    if (left === undefined) {
      return 1;
    }

    if (right === undefined) {
      return -1;
    }

    return Order.Number(left, right);
  },
);

const RequirementCompletionOrder = Order.mapInput(
  UndefinedLastNumberOrder,
  (requirementRow: DungeonRunRequirementRow) => {
    return requirementRow.completedObservation?.observation
      .timestampMilliseconds;
  },
);

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
    <DungeonRunTableRow className="w-full items-center border-t px-3 py-1.5 text-xs">
      <DungeonRunTableLabelCell className="pl-5">
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
    </DungeonRunTableRow>
  );
}

export function DungeonRunMilestone({ milestone }: DungeonRunMilestoneProps) {
  const { isMilestoneExpanded, setMilestoneExpanded } =
    useDungeonRunDisplayState();

  const milestoneKey = String(milestone.milestoneIndex);
  const isOpen = isMilestoneExpanded(milestoneKey);

  const sortedRequirementRows = A.sort(
    milestone.requirementRows,
    RequirementCompletionOrder,
  );

  return (
    <Collapsible
      className="w-full min-w-0"
      onOpenChange={(isExpanded) => {
        setMilestoneExpanded(milestoneKey, isExpanded);
      }}
      open={isOpen}
    >
      <div
        className={cn(
          "w-full min-w-0 overflow-hidden rounded-md border bg-card",
          milestone.isCompleted && "border-border",
        )}
      >
        <CollapsibleTrigger
          render={
            <DungeonRunTableTriggerRow className="w-full items-center px-3 py-2 text-left text-sm hover:bg-muted/40">
              <DungeonRunTableLabelCell>
                <div className="flex min-w-0 items-center gap-1.5">
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
                </div>
              </DungeonRunTableLabelCell>

              <DungeonRunTableTimeCells
                comparisonElapsedMilliseconds={
                  milestone.comparisonElapsedMilliseconds
                }
                segmentMilliseconds={milestone.segmentElapsedMilliseconds}
                totalMilliseconds={milestone.elapsedMilliseconds}
              />
            </DungeonRunTableTriggerRow>
          }
        />

        <CollapsibleContent className="min-w-0 overflow-hidden">
          {A.map(sortedRequirementRows, (requirementRow, requirementIndex) => {
            const observationTimestamp =
              requirementRow.completedObservation?.observation
                .timestampMilliseconds;

            const previousRequirement =
              sortedRequirementRows[requirementIndex - 1];

            const previousTimestamp =
              previousRequirement?.completedObservation?.observation
                .timestampMilliseconds ??
              milestone.segmentStartedAtMilliseconds;

            const segmentElapsedMilliseconds =
              Predicate.isUndefined(observationTimestamp) ||
              Predicate.isUndefined(previousTimestamp)
                ? undefined
                : observationTimestamp - previousTimestamp;

            return (
              <RequirementRow
                key={`${requirementRow.requirement.type}:${requirementRow.requirement.targetId}:${requirementIndex}`}
                requirementRow={requirementRow}
                segmentElapsedMilliseconds={segmentElapsedMilliseconds}
              />
            );
          })}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
