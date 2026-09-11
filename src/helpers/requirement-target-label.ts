import * as Match from "effect/Match";

import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";

type Ability = {
  readonly id: string;
  readonly name: string;
};

type Dungeon = {
  readonly id: string;
  readonly name: string;
};

type Encounter = {
  readonly id: string;
  readonly name: string;
};

type Unit = {
  readonly id: string;
  readonly name: string;
  readonly variant: string | null;
};

type RequirementTargetLabelData = {
  readonly abilitiesById: Readonly<Record<string, Ability>>;
  readonly dungeonsById: Readonly<Record<string, Dungeon>>;
  readonly encountersById: Readonly<Record<string, Encounter>>;
  readonly unitsById: Readonly<Record<string, Unit>>;
};

type GetRequirementTargetLabelOptions = RequirementTargetLabelData & {
  readonly eventType: RequirementEventType;
  readonly targetId: string;
};

function getUnitTargetLabel(unit: Unit): string {
  return unit.variant === null ? unit.name : `${unit.name} (${unit.variant})`;
}

export function getRequirementTargetLabel({
  abilitiesById,
  dungeonsById,
  encountersById,
  eventType,
  targetId,
  unitsById,
}: GetRequirementTargetLabelOptions): string {
  const label = Match.value(eventType).pipe(
    Match.when(FELLOWSHIP_EVENT.ABILITY_ACTIVATED, () => {
      return abilitiesById[targetId]?.name;
    }),
    Match.whenOr(
      FELLOWSHIP_EVENT.DUNGEON_START,
      FELLOWSHIP_EVENT.DUNGEON_END,
      () => {
        return dungeonsById[targetId]?.name;
      },
    ),
    Match.whenOr(
      FELLOWSHIP_EVENT.ENCOUNTER_START,
      FELLOWSHIP_EVENT.ENCOUNTER_END,
      () => {
        return encountersById[targetId]?.name;
      },
    ),
    Match.when(FELLOWSHIP_EVENT.UNIT_DEATH, () => {
      const unit = unitsById[targetId];

      return unit === undefined ? undefined : getUnitTargetLabel(unit);
    }),
    Match.exhaustive,
  );

  return label ?? `Custom (${targetId})`;
}
