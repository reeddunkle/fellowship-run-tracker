import * as Layer from "effect/Layer";

import { FellowshipTrackerLive } from "@/application/fellowship-tracker/fellowship-tracker-service.ts";
import { FellowshipServicesLive } from "@/layers/fellowship-layer.ts";
import { LiveSplitServicesLive } from "@/layers/live-split-layer.ts";
import { makePersistenceLayer } from "@/layers/persistence-layer.ts";
import { DungeonRunWebSocketBroadcasterLive } from "@/services/api/websocket-broadcaster-service.ts";
import { AppSettingsLive } from "@/services/app-settings/app-settings-service.ts";
import { LiveSplitFileLive } from "@/services/live-split/files/live-split-file-service.ts";
import { type DatabaseOptions } from "@/types/app-options.ts";

export type MakeAutosplitLayerOptions = DatabaseOptions;

export function makeAutosplitLayer(options: MakeAutosplitLayerOptions) {
  const PersistenceLive = makePersistenceLayer(options);

  const AppSettingsWithDependenciesLive = AppSettingsLive.pipe(
    Layer.provide(PersistenceLive),
  );

  const FellowshipWithDependenciesLive = FellowshipServicesLive.pipe(
    Layer.provide(AppSettingsWithDependenciesLive),
  );

  const LiveSplitWithDependenciesLive = LiveSplitServicesLive.pipe(
    Layer.provide(AppSettingsWithDependenciesLive),
  );

  const FellowshipTrackerWithDependenciesLive = FellowshipTrackerLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        PersistenceLive,
        FellowshipWithDependenciesLive,
        LiveSplitWithDependenciesLive,
        DungeonRunWebSocketBroadcasterLive,
      ),
    ),
  );

  return Layer.mergeAll(
    PersistenceLive,
    FellowshipTrackerWithDependenciesLive,
    LiveSplitWithDependenciesLive,
    LiveSplitFileLive,
  );
}
