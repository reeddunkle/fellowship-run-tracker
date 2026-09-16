import * as Layer from "effect/Layer";

import { FellowshipTrackerLive } from "@/application/fellowship-tracker/fellowship-tracker-service-live.ts";
import { AppSettingsWithDependenciesLive } from "@/layers/app-settings-layer.ts";
import { FellowshipServicesLive } from "@/layers/fellowship-layer.ts";
import { LiveSplitServicesLive } from "@/layers/live-split-layer.ts";
import { DungeonRunWebSocketBroadcasterLive } from "@/services/api/websocket-broadcaster-service.ts";
import { LiveSplitFileLive } from "@/services/live-split/files/live-split-file-service.ts";

export function makeAutosplitLayer() {
  const FellowshipWithDependenciesLive = FellowshipServicesLive.pipe(
    Layer.provide(AppSettingsWithDependenciesLive),
  );

  const LiveSplitWithDependenciesLive = LiveSplitServicesLive.pipe(
    Layer.provide(AppSettingsWithDependenciesLive),
  );

  const FellowshipTrackerWithDependenciesLive = FellowshipTrackerLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        AppSettingsWithDependenciesLive,
        FellowshipWithDependenciesLive,
        LiveSplitWithDependenciesLive,
        DungeonRunWebSocketBroadcasterLive,
      ),
    ),
  );

  return Layer.mergeAll(
    AppSettingsWithDependenciesLive,
    FellowshipTrackerWithDependenciesLive,
    LiveSplitWithDependenciesLive,
    LiveSplitFileLive,
  );
}
