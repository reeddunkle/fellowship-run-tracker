import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as Predicate from "effect/Predicate";

import { type DungeonRunMilestoneRow } from "@/electron/renderer/components/dungeon-run/dungeon-run-milestone.tsx";
import { getComparisonElapsedMilliseconds } from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-time.ts";
import { type DungeonRunObservationInterpretation } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";
import { isNil } from "@/util/is-nil.ts";

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

const MilestoneCompletionOrder = Order.mapInput(
  UndefinedLastNumberOrder,
  (milestone: DungeonRunMilestoneRow) => {
    return milestone.completedAtMilliseconds;
  },
);

type CreateDungeonRunMilestoneRowsOptions = {
  readonly milestones: ReadonlyArray<DungeonRunMilestoneRow["milestone"]>;
  readonly observations: ReadonlyArray<DungeonRunObservationInterpretation>;
  readonly startedAtMilliseconds: number | null | undefined;
};

export function createDungeonRunMilestoneRows({
  milestones,
  observations,
  startedAtMilliseconds,
}: CreateDungeonRunMilestoneRowsOptions): ReadonlyArray<DungeonRunMilestoneRow> {
  const milestoneRows = A.map(milestones, (milestone, milestoneIndex) => {
    const requirementRows = A.map(milestone.requirements, (requirement) => {
      const matchingObservations = A.filter(observations, (observation) => {
        return A.every(
          [
            observation.observation.type === requirement.type,
            observation.observation.targetId === requirement.targetId,
            observation.occurrence >= requirement.startOccurrence,
            observation.occurrence <
              requirement.startOccurrence + requirement.requiredCount,
          ],
          Boolean,
        );
      });

      const completedObservation =
        matchingObservations.length < requirement.requiredCount
          ? undefined
          : matchingObservations.at(-1);

      return {
        completedObservation,
        matchingObservations,
        requirement,
      };
    });

    const completedRequirementObservations = pipe(
      requirementRows,
      A.map((requirementRow) => {
        return requirementRow.completedObservation;
      }),
      A.filter(
        (observation): observation is DungeonRunObservationInterpretation => {
          return observation !== undefined;
        },
      ),
    );

    const isCompleted =
      requirementRows.length > 0 &&
      completedRequirementObservations.length === requirementRows.length;

    const completedAtMilliseconds = isCompleted
      ? Math.max(
          ...A.map(completedRequirementObservations, (observation) => {
            return observation.observation.timestampMilliseconds;
          }),
        )
      : undefined;

    const elapsedMilliseconds =
      Predicate.isUndefined(completedAtMilliseconds) ||
      isNil(startedAtMilliseconds)
        ? undefined
        : completedAtMilliseconds - startedAtMilliseconds;

    const comparisonElapsedMilliseconds = {
      average: getComparisonElapsedMilliseconds({
        comparison: "AVERAGE",
        requirements: requirementRows,
      }),
      best: getComparisonElapsedMilliseconds({
        comparison: "BEST",
        requirements: requirementRows,
      }),
      goal: milestone.comparisonTime ?? undefined,
      median: getComparisonElapsedMilliseconds({
        comparison: "MEDIAN",
        requirements: requirementRows,
      }),
    };

    return {
      comparisonElapsedMilliseconds,
      completedAtMilliseconds,
      elapsedMilliseconds,
      isCompleted,
      milestone,
      milestoneIndex,
      requirementRows,
      segmentElapsedMilliseconds: undefined,
      segmentStartedAtMilliseconds: undefined,
    } satisfies DungeonRunMilestoneRow;
  });

  const sortedMilestones = A.sort(milestoneRows, MilestoneCompletionOrder);

  return A.map(sortedMilestones, (milestone, milestoneIndex) => {
    if (
      Predicate.isUndefined(milestone.completedAtMilliseconds) ||
      isNil(startedAtMilliseconds)
    ) {
      return milestone;
    }

    const previousMilestone = sortedMilestones[milestoneIndex - 1];

    const segmentStartedAtMilliseconds =
      previousMilestone?.completedAtMilliseconds ?? startedAtMilliseconds;

    return {
      ...milestone,
      segmentElapsedMilliseconds:
        milestone.completedAtMilliseconds - segmentStartedAtMilliseconds,
      segmentStartedAtMilliseconds,
    };
  });
}
