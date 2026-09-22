import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import { type FellowshipService } from "@frt/api/services/fellowship/fellowship-service.ts";

type FellowshipLiveEvents = ReturnType<FellowshipService["liveEvents"]>;
type FellowshipLiveStatus = ReturnType<FellowshipService["liveStatus"]>;

export type MakeFellowshipTestHarnessOptions = {
  readonly liveEvents?: FellowshipLiveEvents;
  readonly liveStatus?: FellowshipLiveStatus;
};

export function makeFellowshipTestHarness({
  liveEvents = Stream.never,
  liveStatus = Stream.never,
}: MakeFellowshipTestHarnessOptions = {}) {
  const fellowship = {
    liveEvents: () => {
      return liveEvents;
    },

    liveStatus: () => {
      return liveStatus;
    },

    readEvents: () => {
      return E.succeed([]);
    },

    streamEvents: () => {
      return Stream.empty;
    },
  } satisfies FellowshipService;

  return {
    fellowship,
  };
}
