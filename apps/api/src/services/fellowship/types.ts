import type * as DateTime from "effect/DateTime";

import { type DungeonEndEvent } from "@frt/shared/fellowship/validation/events/dungeon-end.ts";
import { type DungeonStartEvent } from "@frt/shared/fellowship/validation/events/dungeon-start.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

export type RawFellowshipDungeonRun = {
  readonly end: DungeonEndEvent;
  readonly events: ReadonlyArray<FellowshipEvent>;
  readonly start: DungeonStartEvent;
};

export type FellowshipRunMilestone = {
  readonly elapsedMilliseconds: number;
  readonly label: string;
  readonly milestoneId: string;
  readonly timestamp: DateTime.Utc;
};
