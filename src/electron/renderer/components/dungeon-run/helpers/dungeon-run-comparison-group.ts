import { type DungeonRunApiComparisonGroup } from "@/contracts/dungeon-run/dungeon-run-api-schema.ts";

export const DUNGEON_RUN_COMPARISON_GROUP_OPTIONS = [
  {
    label: "My runs",
    value: "OWN",
  },
  {
    label: "Others' runs",
    value: "COMPARISON",
  },
  {
    label: "All runs",
    value: "ALL",
  },
] as const satisfies ReadonlyArray<{
  readonly label: string;
  readonly value: DungeonRunApiComparisonGroup;
}>;

export function getDungeonRunComparisonGroupLabel(
  comparisonGroup: DungeonRunApiComparisonGroup,
): string {
  const matchingOption = DUNGEON_RUN_COMPARISON_GROUP_OPTIONS.find((option) => {
    return option.value === comparisonGroup;
  });

  return matchingOption?.label ?? comparisonGroup;
}
