import { type DungeonRunApiHistory } from "@/services/api/dungeon-run/dungeon-run-api-schema.ts";

export type DungeonRunHistorySummary = {
  readonly runCount: number;
  readonly sampleCount: number;
};

export function getOwnDungeonRunHistorySummary(
  history: DungeonRunApiHistory | null | undefined,
): DungeonRunHistorySummary {
  return {
    runCount: history?.ownRunCount ?? 0,
    sampleCount: history?.ownSampleCount ?? 0,
  };
}

export function getComparisonDungeonRunHistorySummary(
  history: DungeonRunApiHistory | null | undefined,
): DungeonRunHistorySummary {
  return {
    runCount: history?.comparisonRunCount ?? 0,
    sampleCount: history?.comparisonSampleCount ?? 0,
  };
}
