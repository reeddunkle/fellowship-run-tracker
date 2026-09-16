import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";

export type DungeonRunHistoryKey = Pick<
  FellowshipMilestoneConfiguration,
  "dungeonId" | "dungeonLevel"
>;

export function dungeonRunHistoryKeysEqual(
  left: DungeonRunHistoryKey | null,
  right: DungeonRunHistoryKey | null,
): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return (
    left.dungeonId === right.dungeonId &&
    left.dungeonLevel === right.dungeonLevel
  );
}
