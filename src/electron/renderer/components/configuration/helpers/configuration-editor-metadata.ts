import * as A from "effect/Array";
import * as Match from "effect/Match";

import { type ConfigurationEditorValue } from "@/electron/renderer/components/configuration/form/configuration-form-schema.ts";
import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";

export type RequirementLocation = {
  readonly milestoneIndex: number;
  readonly requirementIndex: number;
};

export type EncounterRequirementMetadata = {
  readonly unmatchedTargetCounts: ReadonlyMap<string, number>;
  readonly unmatchedTargetIds: ReadonlyArray<string>;
};

export type UnitDeathRequirementMetadata = {
  readonly lastTargetId: string | undefined;
  readonly nextStartOccurrenceByTargetId: ReadonlyMap<string, number>;
};

export type ConfigurationEditorRequirementMetadata = {
  readonly encounterEnd: EncounterRequirementMetadata;
  readonly encounterStart: EncounterRequirementMetadata;
  readonly unitDeath: UnitDeathRequirementMetadata;
};

type IndexedRequirement = {
  readonly location: RequirementLocation;
  readonly requirement: ConfigurationEditorValue["milestones"][number]["requirements"][number];
};

export type CreateRequirementMetadataOptions = {
  readonly excluding?: RequirementLocation;
};

function toPositiveInteger(value: string): number | undefined {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

function isSameRequirementLocation(
  left: RequirementLocation,
  right: RequirementLocation,
): boolean {
  return (
    left.milestoneIndex === right.milestoneIndex &&
    left.requirementIndex === right.requirementIndex
  );
}

function addUnmatchedEncounterRequirement({
  matchingTargetCounts,
  ownTargetCounts,
  targetId,
}: {
  readonly matchingTargetCounts: Map<string, number>;
  readonly ownTargetCounts: Map<string, number>;
  readonly targetId: string;
}): void {
  const matchingCount = matchingTargetCounts.get(targetId) ?? 0;

  if (matchingCount > 0) {
    matchingTargetCounts.set(targetId, matchingCount - 1);
    return;
  }

  const ownCount = ownTargetCounts.get(targetId) ?? 0;

  ownTargetCounts.set(targetId, ownCount + 1);
}

function getUnmatchedTargetIds(
  unmatchedTargetCounts: ReadonlyMap<string, number>,
): ReadonlyArray<string> {
  return Array.from(unmatchedTargetCounts)
    .filter(([, count]) => {
      return count > 0;
    })
    .map(([targetId]) => {
      return targetId;
    });
}

export function createRequirementMetadata(
  value: ConfigurationEditorValue,
  { excluding }: CreateRequirementMetadataOptions = {},
): ConfigurationEditorRequirementMetadata {
  const unmatchedEncounterEndTargetCounts = new Map<string, number>();
  const unmatchedEncounterStartTargetCounts = new Map<string, number>();

  const nextUnitDeathStartOccurrenceByTargetId = new Map<string, number>();

  let lastUnitDeathTargetId: string | undefined;

  const requirements = A.flatMap(
    value.milestones,
    (milestone, milestoneIndex) => {
      return A.map(milestone.requirements, (requirement, requirementIndex) => {
        return {
          location: {
            milestoneIndex,
            requirementIndex,
          },
          requirement,
        } satisfies IndexedRequirement;
      });
    },
  );

  A.forEach(requirements, ({ location, requirement }) => {
    if (
      excluding !== undefined &&
      isSameRequirementLocation(location, excluding)
    ) {
      return;
    }

    if (requirement.targetId === "") {
      return;
    }

    Match.value(requirement).pipe(
      Match.when(
        {
          type: FELLOWSHIP_EVENT.ENCOUNTER_START,
        },
        (encounterStartRequirement) => {
          addUnmatchedEncounterRequirement({
            matchingTargetCounts: unmatchedEncounterEndTargetCounts,
            ownTargetCounts: unmatchedEncounterStartTargetCounts,
            targetId: encounterStartRequirement.targetId,
          });
        },
      ),
      Match.when(
        {
          type: FELLOWSHIP_EVENT.ENCOUNTER_END,
        },
        (encounterEndRequirement) => {
          addUnmatchedEncounterRequirement({
            matchingTargetCounts: unmatchedEncounterStartTargetCounts,
            ownTargetCounts: unmatchedEncounterEndTargetCounts,
            targetId: encounterEndRequirement.targetId,
          });
        },
      ),
      Match.when(
        {
          type: FELLOWSHIP_EVENT.UNIT_DEATH,
        },
        (unitDeathRequirement) => {
          const startOccurrence = toPositiveInteger(
            unitDeathRequirement.startOccurrence,
          );

          const requiredCount = toPositiveInteger(
            unitDeathRequirement.requiredCount,
          );

          if (startOccurrence === undefined || requiredCount === undefined) {
            return;
          }

          const currentNextStartOccurrence =
            nextUnitDeathStartOccurrenceByTargetId.get(
              unitDeathRequirement.targetId,
            ) ?? 1;

          const requirementNextStartOccurrence =
            startOccurrence + requiredCount;

          nextUnitDeathStartOccurrenceByTargetId.set(
            unitDeathRequirement.targetId,
            Math.max(
              currentNextStartOccurrence,
              requirementNextStartOccurrence,
            ),
          );

          lastUnitDeathTargetId = unitDeathRequirement.targetId;
        },
      ),
      Match.orElse(() => undefined),
    );
  });

  return {
    encounterEnd: {
      unmatchedTargetCounts: unmatchedEncounterEndTargetCounts,
      unmatchedTargetIds: getUnmatchedTargetIds(
        unmatchedEncounterEndTargetCounts,
      ),
    },
    encounterStart: {
      unmatchedTargetCounts: unmatchedEncounterStartTargetCounts,
      unmatchedTargetIds: getUnmatchedTargetIds(
        unmatchedEncounterStartTargetCounts,
      ),
    },
    unitDeath: {
      lastTargetId: lastUnitDeathTargetId,
      nextStartOccurrenceByTargetId: nextUnitDeathStartOccurrenceByTargetId,
    },
  };
}
