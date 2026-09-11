import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import { type RawFellowshipDungeonRun } from "@/services/fellowship/types.ts";
import { doesDungeonIdentityMatch } from "@/services/fellowship/utilities/does-dungeon-identity-match.ts";
import { isDungeonExitEvent } from "@/services/fellowship/utilities/is-dungeon-exit-event.ts";
import { type DungeonStartEvent } from "@/services/fellowship/validation/events/dungeon-start.ts";
import { type FellowshipEvent } from "@/services/fellowship/validation/fellowship-event-schema.ts";

export type DungeonRunTrackerState = {
  readonly currentEvents: ReadonlyArray<FellowshipEvent>;
  readonly currentStart: DungeonStartEvent | undefined;
};

export const initialDungeonRunTrackerState = {
  currentEvents: [],
  currentStart: undefined,
} satisfies DungeonRunTrackerState;

export type DungeonRunTrackerResult = {
  readonly completedRun?: RawFellowshipDungeonRun;
  readonly state: DungeonRunTrackerState;
};

export type TrackDungeonRunEventOptions = {
  readonly event: FellowshipEvent;
  readonly state: DungeonRunTrackerState;
};

export function trackDungeonRunEvent({
  event,
  state,
}: TrackDungeonRunEventOptions): DungeonRunTrackerResult {
  if (event.type === FELLOWSHIP_EVENT.DUNGEON_START) {
    return {
      state: {
        currentEvents: [event],
        currentStart: event,
      },
    };
  }

  if (state.currentStart === undefined) {
    return { state };
  }

  if (
    isDungeonExitEvent({
      event,
      runStart: state.currentStart,
    })
  ) {
    return {
      state: {
        currentEvents: [],
        currentStart: undefined,
      },
    };
  }

  const currentEvents = [...state.currentEvents, event];

  const hasCompletedCurrentDungeon =
    event.type === FELLOWSHIP_EVENT.DUNGEON_END &&
    doesDungeonIdentityMatch({
      left: event,
      right: state.currentStart,
    });

  if (!hasCompletedCurrentDungeon) {
    return {
      state: {
        ...state,
        currentEvents,
      },
    };
  }

  const completedRun = {
    end: event,
    events: currentEvents,
    start: state.currentStart,
  } satisfies RawFellowshipDungeonRun;

  return {
    completedRun,
    state: {
      currentEvents: [],
      currentStart: undefined,
    },
  };
}
