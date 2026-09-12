import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Option from "effect/Option";

import { getComparisonElapsedMilliseconds } from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-time.ts";
import { type DungeonRunObservationInterpretation } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";
import { type ConfigurationApiConfiguration } from "@/services/api/configuration/configuration-api-schema.ts";

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

export function createDungeonRunMilestoneRows({
  milestones,
  observations,
  startedAtMilliseconds,
}: {
  readonly milestones: ReadonlyArray<Milestone>;
  readonly observations: ReadonlyArray<DungeonRunObservationInterpretation>;
  readonly startedAtMilliseconds: number | undefined;
}): ReadonlyArray<DungeonRunMilestoneRow> {
  let previousCompletedAtMilliseconds = startedAtMilliseconds;

  return A.map(milestones, (milestone, milestoneIndex) => {
    const requirementRows = A.map(
      milestone.requirements,
      (requirement): DungeonRunRequirementRow => {
        const occurrenceEnd =
          requirement.startOccurrence + requirement.requiredCount;

        const matchingObservations = A.filter(observations, (observation) => {
          return (
            observation.observation.type === requirement.type &&
            observation.observation.targetId === requirement.targetId &&
            observation.occurrence >= requirement.startOccurrence &&
            observation.occurrence < occurrenceEnd
          );
        });

        const completedObservation =
          matchingObservations.length === requirement.requiredCount
            ? Option.getOrUndefined(A.last(matchingObservations))
            : undefined;

        return {
          completedObservation,
          matchingObservations,
          requirement,
        };
      },
    );

    const isCompleted = A.every(requirementRows, (requirementRow) => {
      return requirementRow.completedObservation !== undefined;
    });

    const completedObservationTimestamps = pipe(
      requirementRows,
      A.filter(
        (
          requirementRow,
        ): requirementRow is DungeonRunRequirementRow & {
          readonly completedObservation: DungeonRunObservationInterpretation;
        } => {
          return requirementRow.completedObservation !== undefined;
        },
      ),
      A.map((requirementRow) => {
        return requirementRow.completedObservation.observation
          .timestampMilliseconds;
      }),
    );

    const completedAtMilliseconds =
      isCompleted && completedObservationTimestamps.length > 0
        ? Math.max(...completedObservationTimestamps)
        : undefined;

    const elapsedMilliseconds =
      completedAtMilliseconds === undefined ||
      startedAtMilliseconds === undefined
        ? undefined
        : completedAtMilliseconds - startedAtMilliseconds;

    const segmentStartedAtMilliseconds = previousCompletedAtMilliseconds;

    const segmentElapsedMilliseconds =
      completedAtMilliseconds === undefined ||
      segmentStartedAtMilliseconds === undefined
        ? undefined
        : completedAtMilliseconds - segmentStartedAtMilliseconds;

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

    if (completedAtMilliseconds !== undefined) {
      previousCompletedAtMilliseconds = completedAtMilliseconds;
    }

    return {
      comparisonElapsedMilliseconds,
      completedAtMilliseconds,
      elapsedMilliseconds,
      isCompleted,
      milestone,
      milestoneIndex,
      requirementRows,
      segmentElapsedMilliseconds,
      segmentStartedAtMilliseconds,
    };
  });
}
