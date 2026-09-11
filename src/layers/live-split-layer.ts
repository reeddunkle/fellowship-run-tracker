import * as Layer from "effect/Layer";

import { LiveSplitConnectionManagerLive } from "@/services/live-split/core/live-split-connection-manager-service.ts";
import { LiveSplitLive } from "@/services/live-split/core/live-split-service.ts";

export const LiveSplitServicesLive = LiveSplitLive.pipe(
  Layer.provide(LiveSplitConnectionManagerLive),
);
