import { type RawFellowshipDungeonRun } from "@frt/api/services/fellowship/types.ts";
import { doesDungeonIdentityMatch } from "@frt/api/services/fellowship/utilities/does-dungeon-identity-match.ts";
import { isDungeonExitEvent } from "@frt/api/services/fellowship/utilities/is-dungeon-exit-event.ts";
import { FELLOWSHIP_EVENT } from "@frt/shared/fellowship/constants/fellowship-event.ts";
import { type DungeonStartEvent } from "@frt/shared/fellowship/validation/events/dungeon-start.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

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
  readonly exitedRunStart?: DungeonStartEvent;
  readonly startedRun?: DungeonStartEvent;
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
      startedRun: event,
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
      exitedRunStart: state.currentStart,
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
