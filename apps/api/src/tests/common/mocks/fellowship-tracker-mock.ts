import * as Layer from "effect/Layer";

import {
  FellowshipTracker,
  type FellowshipTrackerShape,
} from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import {
  unexpectedEffectCall,
  unexpectedStreamCall,
} from "@frt/api/tests/common/mocks/unexpected-service-call.ts";

export type MakeFellowshipTrackerMockOptions = Partial<FellowshipTrackerShape>;

export function makeFellowshipTrackerMock({
  replayLog = unexpectedEffectCall("FellowshipTracker", "replayLog"),
  start = unexpectedEffectCall("FellowshipTracker", "start"),
  startConfiguration = unexpectedEffectCall(
    "FellowshipTracker",
    "startConfiguration",
  ),
  status = unexpectedEffectCall("FellowshipTracker", "status")(),
  statusChanges = unexpectedStreamCall("FellowshipTracker", "statusChanges"),
  stop = unexpectedEffectCall("FellowshipTracker", "stop"),
}: MakeFellowshipTrackerMockOptions = {}) {
  return Layer.succeed(FellowshipTracker, {
    replayLog,
    start,
    startConfiguration,
    status,
    statusChanges,
    stop,
  } satisfies FellowshipTrackerShape);
}

export const FellowshipTrackerMock = makeFellowshipTrackerMock();
