import * as Layer from "effect/Layer";

import {
  LiveSplit,
  type LiveSplitShape,
} from "@frt/api/services/live-split/live-split-service.ts";
import {
  unexpectedEffectCall,
  unexpectedStreamCall,
} from "@frt/api/tests/common/mocks/unexpected-service-call.ts";

export type MakeLiveSplitMockOptions = Partial<LiveSplitShape>;

function makeLiveSplitMock({
  connect = unexpectedEffectCall("LiveSplit", "connect"),
  disconnect = unexpectedEffectCall("LiveSplit", "disconnect"),
  getStatus = unexpectedEffectCall("LiveSplit", "getStatus"),
  handleRunEvent = unexpectedEffectCall("LiveSplit", "handleRunEvent"),
  statusChanges = unexpectedStreamCall("LiveSplit", "statusChanges"),
}: MakeLiveSplitMockOptions = {}) {
  return Layer.succeed(LiveSplit, {
    connect,
    disconnect,
    getStatus,
    handleRunEvent,
    statusChanges,
  } satisfies LiveSplitShape);
}

export const LiveSplitMock = makeLiveSplitMock();
