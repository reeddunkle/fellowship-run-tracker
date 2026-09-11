import * as Match from "effect/Match";

import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";
import { type FellowshipRequirement } from "@/services/fellowship/validation/fellowship-configuration-file-schema.ts";
import { type FellowshipEvent } from "@/services/fellowship/validation/fellowship-event-schema.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";

export type RequirementTargetId = string;

export type RequirementLookup = {
  readonly targetId: RequirementTargetId;
  readonly type: RequirementEventType;
};

export function getRequirementLookup({
  dungeonId,
  requirement,
}: {
  readonly dungeonId: DungeonId;
  readonly requirement: FellowshipRequirement;
}): RequirementLookup {
  return Match.value(requirement).pipe(
    Match.when(
      { type: FELLOWSHIP_EVENT.ABILITY_ACTIVATED },
      (matchedRequirement) => {
        return {
          targetId: matchedRequirement.abilityId,
          type: matchedRequirement.type,
        };
      },
    ),
    Match.when(
      { type: FELLOWSHIP_EVENT.DUNGEON_START },
      (matchedRequirement) => {
        return {
          targetId: dungeonId,
          type: matchedRequirement.type,
        };
      },
    ),
    Match.when({ type: FELLOWSHIP_EVENT.DUNGEON_END }, (matchedRequirement) => {
      return {
        targetId: dungeonId,
        type: matchedRequirement.type,
      };
    }),
    Match.when(
      { type: FELLOWSHIP_EVENT.ENCOUNTER_START },
      (matchedRequirement) => {
        return {
          targetId: matchedRequirement.encounterId,
          type: matchedRequirement.type,
        };
      },
    ),
    Match.when(
      { type: FELLOWSHIP_EVENT.ENCOUNTER_END },
      (matchedRequirement) => {
        return {
          targetId: matchedRequirement.encounterId,
          type: matchedRequirement.type,
        };
      },
    ),
    Match.when({ type: FELLOWSHIP_EVENT.UNIT_DEATH }, (matchedRequirement) => {
      return {
        targetId: matchedRequirement.unitTypeId,
        type: matchedRequirement.type,
      };
    }),
    Match.exhaustive,
  );
}

export function getRequirementLookupForEvent(
  event: FellowshipEvent,
): RequirementLookup | undefined {
  return Match.value(event).pipe(
    Match.when({ type: FELLOWSHIP_EVENT.ABILITY_ACTIVATED }, (matchedEvent) => {
      return {
        targetId: matchedEvent.abilityId,
        type: matchedEvent.type,
      };
    }),
    Match.when({ type: FELLOWSHIP_EVENT.DUNGEON_START }, (matchedEvent) => {
      return {
        targetId: matchedEvent.dungeonId,
        type: matchedEvent.type,
      };
    }),
    Match.when({ type: FELLOWSHIP_EVENT.DUNGEON_END }, (matchedEvent) => {
      return {
        targetId: matchedEvent.dungeonId,
        type: matchedEvent.type,
      };
    }),
    Match.when({ type: FELLOWSHIP_EVENT.ENCOUNTER_START }, (matchedEvent) => {
      return {
        targetId: matchedEvent.encounterId,
        type: matchedEvent.type,
      };
    }),
    Match.when({ type: FELLOWSHIP_EVENT.ENCOUNTER_END }, (matchedEvent) => {
      return {
        targetId: matchedEvent.encounterId,
        type: matchedEvent.type,
      };
    }),
    Match.when({ type: FELLOWSHIP_EVENT.UNIT_DEATH }, (matchedEvent) => {
      return {
        targetId: matchedEvent.unitTypeId,
        type: matchedEvent.type,
      };
    }),
    Match.orElse(() => {
      return undefined;
    }),
  );
}
