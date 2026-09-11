import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import { createLiveSplitApiResponse } from "@/services/api/live-split/create-live-split-api-response.ts";
import {
  LiveSplitApiService,
  type LiveSplitApiServiceShape,
} from "@/services/api/live-split/live-split-api-service.ts";

export type MakeLiveSplitApiServiceMockOptions =
  Partial<LiveSplitApiServiceShape>;

const DEFAULT_STATUS = createLiveSplitApiResponse({
  _tag: "Disconnected",
});

function makeLiveSplitApiServiceMock({
  connect = () => {
    return E.succeed(DEFAULT_STATUS);
  },
  disconnect = () => {
    return E.succeed(DEFAULT_STATUS);
  },
  getStatus = () => {
    return E.succeed(DEFAULT_STATUS);
  },
  statusChanges = Stream.make(DEFAULT_STATUS),
}: MakeLiveSplitApiServiceMockOptions = {}) {
  return Layer.succeed(LiveSplitApiService, {
    connect,
    disconnect,
    getStatus,
    statusChanges,
  } satisfies LiveSplitApiServiceShape);
}

export const LiveSplitApiServiceMock = makeLiveSplitApiServiceMock();
