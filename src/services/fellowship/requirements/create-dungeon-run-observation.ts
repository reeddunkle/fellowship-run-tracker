import type * as DateTime from "effect/DateTime";

import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import {
  getRequirementLookupForEvent,
  type RequirementLookup,
} from "@/services/fellowship/requirements/requirement-lookup.ts";
import { type FellowshipEvent } from "@/services/fellowship/validation/fellowship-event-schema.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";

export type DungeonRunObservation = {
  readonly targetId: RequirementLookup["targetId"];
  readonly timestamp: DateTime.Utc;
  readonly type: RequirementEventType;
};

function getEventTimestamp(event: FellowshipEvent): DateTime.Utc {
  return event.type === FELLOWSHIP_EVENT.DUNGEON_START
    ? event.startedAt
    : event.timestamp;
}

export function createDungeonRunObservation(
  event: FellowshipEvent,
): DungeonRunObservation | undefined {
  const lookup = getRequirementLookupForEvent(event);

  if (lookup === undefined) {
    return undefined;
  }

  return {
    targetId: lookup.targetId,
    timestamp: getEventTimestamp(event),
    type: lookup.type,
  };
}
