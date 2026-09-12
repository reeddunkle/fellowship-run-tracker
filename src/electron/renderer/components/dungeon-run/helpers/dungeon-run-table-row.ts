import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as Predicate from "effect/Predicate";

import {
  type DungeonRunMilestoneRow,
  type DungeonRunRequirementRow,
} from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-milestone-rows.ts";

export type DungeonRunTableMilestoneRow = {
  readonly type: "milestone";
  readonly milestone: DungeonRunMilestoneRow;
  readonly subRows: ReadonlyArray<DungeonRunTableRequirementRow>;
};

export type DungeonRunTableRequirementRow = {
  readonly type: "requirement";
  readonly requirementRow: DungeonRunRequirementRow;
  readonly segmentElapsedMilliseconds: number | undefined;
};

export type DungeonRunTableRow =
  | DungeonRunTableMilestoneRow
  | DungeonRunTableRequirementRow;

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

export function createDungeonRunTableRows(
  milestoneRows: ReadonlyArray<DungeonRunMilestoneRow>,
): Array<DungeonRunTableMilestoneRow> {
  return A.map(milestoneRows, (milestoneRow) => {
    const sortedRequirementRows = A.sort(
      milestoneRow.requirementRows,
      RequirementCompletionOrder,
    );

    const subRows = A.map(
      sortedRequirementRows,
      (requirementRow, requirementIndex): DungeonRunTableRequirementRow => {
        const observationTimestamp =
          requirementRow.completedObservation?.observation
            .timestampMilliseconds;

        const previousRequirement = sortedRequirementRows[requirementIndex - 1];

        const previousTimestamp =
          previousRequirement?.completedObservation?.observation
            .timestampMilliseconds ?? milestoneRow.segmentStartedAtMilliseconds;

        const segmentElapsedMilliseconds =
          Predicate.isUndefined(observationTimestamp) ||
          Predicate.isUndefined(previousTimestamp)
            ? undefined
            : observationTimestamp - previousTimestamp;

        return {
          requirementRow,
          segmentElapsedMilliseconds,
          type: "requirement",
        };
      },
    );

    return {
      milestone: milestoneRow,
      subRows,
      type: "milestone",
    };
  });
}
