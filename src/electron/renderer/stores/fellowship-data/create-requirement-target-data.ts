import * as A from "effect/Array";
import * as R from "effect/Record";

import { type AbilityApiAbilityList } from "@/services/api/ability/ability-api-schema.ts";
import { type DungeonApiDungeonList } from "@/services/api/dungeon/dungeon-api-schema.ts";
import { type EncounterApiEncounterList } from "@/services/api/encounter/encounter-api-schema.ts";
import { type UnitApiUnitList } from "@/services/api/unit/unit-api-schema.ts";
import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";

export type RequirementTargetOption = {
  readonly id: string;
  readonly label: string;
};

export type RequirementTargetOptions = {
  readonly options: ReadonlyArray<RequirementTargetOption>;
  readonly optionsById: Readonly<Record<string, RequirementTargetOption>>;
};

export type RequirementTargetsByEventType = Readonly<
  Record<RequirementEventType, RequirementTargetOptions>
>;

type CreateRequirementTargetDataOptions = {
  readonly abilities: AbilityApiAbilityList;
  readonly dungeons: DungeonApiDungeonList;
  readonly encounters: EncounterApiEncounterList;
  readonly units: UnitApiUnitList;
};

function createRequirementTargetOptions(
  options: ReadonlyArray<RequirementTargetOption>,
): RequirementTargetOptions {
  return {
    options,
    optionsById: R.fromIterableBy(options, (option) => {
      return option.id;
    }),
  };
}

export function createRequirementTargetsByEventType({
  abilities,
  dungeons,
  encounters,
  units,
}: CreateRequirementTargetDataOptions): RequirementTargetsByEventType {
  const abilityOptions = A.map(abilities, (ability) => {
    return {
      id: ability.id,
      label: ability.name,
    };
  });

  const dungeonOptions = A.map(dungeons, (dungeon) => {
    return {
      id: dungeon.id,
      label: dungeon.name,
    };
  });

  const encounterOptions = A.map(encounters, (encounter) => {
    return {
      id: encounter.id,
      label: encounter.name,
    };
  });

  const unitOptions = A.map(units, (unit) => {
    return {
      id: unit.id,
      label:
        unit.variant === null ? unit.name : `${unit.name} (${unit.variant})`,
    };
  });

  return {
    [FELLOWSHIP_EVENT.ABILITY_ACTIVATED]:
      createRequirementTargetOptions(abilityOptions),

    [FELLOWSHIP_EVENT.DUNGEON_END]:
      createRequirementTargetOptions(dungeonOptions),

    [FELLOWSHIP_EVENT.DUNGEON_START]:
      createRequirementTargetOptions(dungeonOptions),

    [FELLOWSHIP_EVENT.ENCOUNTER_END]:
      createRequirementTargetOptions(encounterOptions),

    [FELLOWSHIP_EVENT.ENCOUNTER_START]:
      createRequirementTargetOptions(encounterOptions),

    [FELLOWSHIP_EVENT.UNIT_DEATH]: createRequirementTargetOptions(unitOptions),
  } satisfies RequirementTargetsByEventType;
}
