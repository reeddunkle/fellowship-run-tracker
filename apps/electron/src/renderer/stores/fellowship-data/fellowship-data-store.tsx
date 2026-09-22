import * as R from "effect/Record";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState,
} from "react";
import { createStore, useStore } from "zustand";

import {
  type AbilityApiAbility,
  type AbilityApiAbilityList,
} from "@frt/shared/ability/ability-api-schema.ts";
import {
  type DungeonApiDungeon,
  type DungeonApiDungeonList,
} from "@frt/shared/dungeon/dungeon-api-schema.ts";
import {
  type EncounterApiEncounter,
  type EncounterApiEncounterList,
} from "@frt/shared/encounter/encounter-api-schema.ts";
import {
  type UnitApiUnit,
  type UnitApiUnitList,
} from "@frt/shared/unit/unit-api-schema.ts";
import { ReactContextError } from "@frt/ui/errors/react-context-error.ts";

import {
  createRequirementTargetsByEventType,
  type RequirementTargetsByEventType,
} from "@/renderer/stores/fellowship-data/create-requirement-target-data.ts";

type FellowshipDataStoreProps = {
  readonly abilities: AbilityApiAbilityList;
  readonly dungeons: DungeonApiDungeonList;
  readonly encounters: EncounterApiEncounterList;
  readonly units: UnitApiUnitList;
};

type FellowshipDataStoreState = FellowshipDataStoreProps & {
  readonly abilitiesById: Readonly<Record<string, AbilityApiAbility>>;
  readonly dungeonsById: Readonly<Record<string, DungeonApiDungeon>>;
  readonly encountersById: Readonly<Record<string, EncounterApiEncounter>>;
  readonly requirementTargetsByEventType: RequirementTargetsByEventType;
  readonly unitsById: Readonly<Record<string, UnitApiUnit>>;
};

function createFellowshipDataStore(props: FellowshipDataStoreProps) {
  return createStore<FellowshipDataStoreState>()(() => {
    return {
      ...props,
      abilitiesById: R.fromIterableBy(props.abilities, (ability) => {
        return ability.id;
      }),
      dungeonsById: R.fromIterableBy(props.dungeons, (dungeon) => {
        return dungeon.id;
      }),
      encountersById: R.fromIterableBy(props.encounters, (encounter) => {
        return encounter.id;
      }),
      requirementTargetsByEventType: createRequirementTargetsByEventType(props),
      unitsById: R.fromIterableBy(props.units, (unit) => {
        return unit.id;
      }),
    };
  });
}

type FellowshipDataStore = ReturnType<typeof createFellowshipDataStore>;

const FellowshipDataContext = createContext<FellowshipDataStore | null>(null);

type FellowshipDataProviderProps = PropsWithChildren<FellowshipDataStoreProps>;

export function FellowshipDataProvider({
  abilities,
  children,
  dungeons,
  encounters,
  units,
}: FellowshipDataProviderProps) {
  const [store] = useState(() => {
    return createFellowshipDataStore({
      abilities,
      dungeons,
      encounters,
      units,
    });
  });

  return (
    <FellowshipDataContext.Provider value={store}>
      {children}
    </FellowshipDataContext.Provider>
  );
}

function useFellowshipDataContext() {
  const context = useContext(FellowshipDataContext);

  if (context === null) {
    throw new ReactContextError({
      hookName: "useFellowshipDataContext",
      providerName: "FellowshipDataProvider",
    });
  }

  return context;
}

export function useFellowshipDataStore<T>(
  selector: (state: FellowshipDataStoreState) => T,
): T {
  const store = useFellowshipDataContext();

  return useStore(store, selector);
}
