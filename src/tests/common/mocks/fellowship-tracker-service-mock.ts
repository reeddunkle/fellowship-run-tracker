import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import { FellowshipTracker } from "@/application/fellowship-tracker/fellowship-tracker-service.ts";
import { type FellowshipTrackerServiceShape } from "@/application/fellowship-tracker/fellowship-tracker-service-types.ts";

export type MakeFellowshipTrackerMockOptions =
  Partial<FellowshipTrackerServiceShape>;

function makeFellowshipTrackerMock({
  replayLog = () => {
    return E.void;
  },
  start = () => {
    return E.void;
  },
  startConfiguration = () => {
    return E.void;
  },
  status = E.succeed({
    _tag: "Idle",
  }),
  statusChanges = Stream.make({
    _tag: "Idle",
  }),
  stop = () => {
    return E.void;
  },
}: MakeFellowshipTrackerMockOptions = {}) {
  return Layer.succeed(FellowshipTracker, {
    replayLog,
    start,
    startConfiguration,
    status,
    statusChanges,
    stop,
  } satisfies FellowshipTrackerServiceShape);
}

export const FellowshipTrackerMock = makeFellowshipTrackerMock();
