import type * as Schema from "effect/Schema";

import {
  FELLOWSHIP_EVENT,
  type FellowshipEventType,
} from "@/services/fellowship/constants/fellowship-event.ts";

import { AbilityActivatedEventFromLogSchema } from "./events/ability-activated.ts";
import { DungeonEndEventFromLogSchema } from "./events/dungeon-end.ts";
import { DungeonStartEventFromLogSchema } from "./events/dungeon-start.ts";
import { EncounterEndEventFromLogSchema } from "./events/encounter-end.ts";
import { EncounterStartEventFromLogSchema } from "./events/encounter-start.ts";
import { MapChangeEventFromLogSchema } from "./events/map-change.ts";
import { UnitDeathEventFromLogSchema } from "./events/unit-death.ts";
import { ZoneChangeEventFromLogSchema } from "./events/zone-change.ts";

export const fellowshipEventSchemas = {
  [FELLOWSHIP_EVENT.ABILITY_ACTIVATED]: AbilityActivatedEventFromLogSchema,
  [FELLOWSHIP_EVENT.DUNGEON_END]: DungeonEndEventFromLogSchema,
  [FELLOWSHIP_EVENT.DUNGEON_START]: DungeonStartEventFromLogSchema,
  [FELLOWSHIP_EVENT.ENCOUNTER_END]: EncounterEndEventFromLogSchema,
  [FELLOWSHIP_EVENT.ENCOUNTER_START]: EncounterStartEventFromLogSchema,
  [FELLOWSHIP_EVENT.MAP_CHANGE]: MapChangeEventFromLogSchema,
  [FELLOWSHIP_EVENT.UNIT_DEATH]: UnitDeathEventFromLogSchema,
  [FELLOWSHIP_EVENT.ZONE_CHANGE]: ZoneChangeEventFromLogSchema,
} as const;

export type ParsedFellowshipEventType = keyof typeof fellowshipEventSchemas;

type FellowshipEventSchema =
  (typeof fellowshipEventSchemas)[ParsedFellowshipEventType];

export type FellowshipEvent = Schema.Schema.Type<FellowshipEventSchema>;

export function isParsedFellowshipEventType(
  eventType: FellowshipEventType | undefined,
): eventType is ParsedFellowshipEventType {
  return (
    eventType !== undefined && Object.hasOwn(fellowshipEventSchemas, eventType)
  );
}
