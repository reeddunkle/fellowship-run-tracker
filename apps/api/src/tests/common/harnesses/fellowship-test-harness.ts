import * as Stream from "effect/Stream";

import { makeFellowshipLiveLogFromEvents } from "@frt/api/services/fellowship/fellowship-live-log.ts";
import { type FellowshipShape } from "@frt/api/services/fellowship/fellowship-service.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

type FellowshipLiveLog = ReturnType<FellowshipShape["liveLog"]>;
type FellowshipReplayEvents = ReturnType<FellowshipShape["streamEvents"]>;

export const TEST_LIVE_LOG_FILE_PATH = "/logs/fellowship.txt";

export function makeTestLiveLog<Error>(
  events: Stream.Stream<FellowshipEvent, Error>,
) {
  return makeFellowshipLiveLogFromEvents({
    events,
    filePath: TEST_LIVE_LOG_FILE_PATH,
  });
}

export type MakeFellowshipTestHarnessOptions = {
  readonly liveLog?: FellowshipLiveLog;
  readonly replayEvents?: FellowshipReplayEvents;
};

export function makeFellowshipTestHarness({
  liveLog = Stream.never,
  replayEvents = Stream.empty,
}: MakeFellowshipTestHarnessOptions = {}) {
  const fellowship = {
    liveLog: () => {
      return liveLog;
    },

    streamEvents: () => {
      return replayEvents;
    },
  } satisfies FellowshipShape;

  return {
    fellowship,
  };
}
