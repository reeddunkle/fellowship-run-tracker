import { type ConfigurationApiConfiguration } from "@/contracts/configuration/configuration-api-schema.ts";
import { type DungeonRunApiObservationStatistics } from "@/contracts/dungeon-run/dungeon-run-api-schema.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";
import { encodeRequirementObservationOccurrenceIdentity } from "@/validation/common/requirement-observation-identity-schema.ts";

export type HistoryRequirementComparisonRow = {
  readonly comparison: DungeonRunApiObservationStatistics | undefined;
  readonly key: string;
  readonly milestoneLabel: string;
  readonly mine: DungeonRunApiObservationStatistics | undefined;
  readonly occurrence: number;
  readonly targetId: string;
  readonly type: RequirementEventType;
};

function groupStatisticsByIdentity(
  observations: ReadonlyArray<DungeonRunApiObservationStatistics>,
): Map<string, ReadonlyArray<DungeonRunApiObservationStatistics>> {
  const statisticsByIdentity = new Map<
    string,
    Array<DungeonRunApiObservationStatistics>
  >();

  for (const statistics of observations) {
    const key = encodeRequirementObservationOccurrenceIdentity([
      statistics.type,
      statistics.targetId,
      statistics.occurrence,
    ]);

    const existingStatistics = statisticsByIdentity.get(key);

    if (existingStatistics === undefined) {
      statisticsByIdentity.set(key, [statistics]);

      continue;
    }

    existingStatistics.push(statistics);
  }

  return statisticsByIdentity;
}

type CreateHistoryRequirementComparisonRowsOptions = {
  readonly milestones: ConfigurationApiConfiguration["milestones"];
  readonly observations: ReadonlyArray<DungeonRunApiObservationStatistics>;
};

export function createHistoryRequirementComparisonRows({
  milestones,
  observations,
}: CreateHistoryRequirementComparisonRowsOptions): ReadonlyArray<HistoryRequirementComparisonRow> {
  const statisticsByIdentity = groupStatisticsByIdentity(observations);

  return milestones.flatMap((milestone, milestoneIndex) => {
    return milestone.requirements.map((requirement, requirementIndex) => {
      const occurrence =
        requirement.startOccurrence + requirement.requiredCount - 1;

      const identityKey = encodeRequirementObservationOccurrenceIdentity([
        requirement.type,
        requirement.targetId,
        occurrence,
      ]);

      const statistics = statisticsByIdentity.get(identityKey) ?? [];

      return {
        comparison: statistics.find((entry) => {
          return entry.comparisonGroup === "COMPARISON";
        }),
        key: `${milestoneIndex}:${requirementIndex}`,
        milestoneLabel: milestone.label,
        mine: statistics.find((entry) => {
          return entry.comparisonGroup === "OWN";
        }),
        occurrence,
        targetId: requirement.targetId,
        type: requirement.type,
      } satisfies HistoryRequirementComparisonRow;
    });
  });
}
