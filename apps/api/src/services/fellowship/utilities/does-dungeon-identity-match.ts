type DungeonIdentity = {
  readonly adventureDifficulty?: "EASY" | "MEDIUM" | "HARD" | undefined;
  readonly dungeonCategory?: "ADVENTURE" | "ETERNAL" | undefined;
  readonly dungeonId: string;
  readonly dungeonLevel: number | undefined;
};

export function doesDungeonIdentityMatch({
  left,
  right,
}: {
  readonly left: DungeonIdentity;
  readonly right: DungeonIdentity;
}): boolean {
  const leftCategory = left.dungeonCategory ?? "ETERNAL";
  const rightCategory = right.dungeonCategory ?? "ETERNAL";

  return (
    left.dungeonLevel !== undefined &&
    right.dungeonLevel !== undefined &&
    left.dungeonId === right.dungeonId &&
    left.dungeonLevel === right.dungeonLevel &&
    leftCategory === rightCategory &&
    (leftCategory === "ETERNAL" ||
      left.adventureDifficulty === undefined ||
      right.adventureDifficulty === undefined ||
      left.adventureDifficulty === right.adventureDifficulty)
  );
}
