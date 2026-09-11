type DungeonIdentity = {
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
  return (
    left.dungeonLevel !== undefined &&
    right.dungeonLevel !== undefined &&
    left.dungeonId === right.dungeonId &&
    left.dungeonLevel === right.dungeonLevel
  );
}
