type FellowshipAbilityDefinition = {
  readonly id: string;
  readonly name: string;
  readonly unitId: string;
};

export const FELLOWSHIP_ABILITY = {
  "634": {
    id: "634",
    name: "Stormy Retreat",
    unitId: "133",
  },
} as const satisfies Record<string, FellowshipAbilityDefinition>;
