import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import { createLiveSplitApiResponse } from "@frt/api/services/live-split/create-live-split-api-response.ts";
import {
  LiveSplit,
  type LiveSplitShape,
} from "@frt/api/services/live-split/live-split-service.ts";

export type MakeLiveSplitMockOptions = Partial<LiveSplitShape>;

const DEFAULT_STATUS = createLiveSplitApiResponse({
  _tag: "Disconnected",
});

function makeLiveSplitMock({
  connect = () => {
    return E.succeed(DEFAULT_STATUS);
  },
  disconnect = () => {
    return E.succeed(DEFAULT_STATUS);
  },
  getStatus = () => {
    return E.succeed(DEFAULT_STATUS);
  },
  handleRunEvent = () => {
    return E.void;
  },
  statusChanges = Stream.make(DEFAULT_STATUS),
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
