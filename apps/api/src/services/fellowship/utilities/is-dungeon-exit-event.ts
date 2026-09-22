import { FELLOWSHIP_EVENT } from "@frt/shared/fellowship/constants/fellowship-event.ts";
import { type DungeonStartEvent } from "@frt/shared/fellowship/validation/events/dungeon-start.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

export type IsDungeonExitEventOptions = {
  readonly event: FellowshipEvent;
  readonly runStart: DungeonStartEvent;
};

export function isDungeonExitEvent({
  event,
  runStart,
}: IsDungeonExitEventOptions): boolean {
  return (
    event.type === FELLOWSHIP_EVENT.ZONE_CHANGE &&
    (event.dungeonId !== runStart.dungeonId ||
      event.absoluteDungeonLevel !== runStart.absoluteDungeonLevel)
  );
}
