import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";

import { FellowshipTrackerLive } from "@/application/fellowship-tracker/fellowship-tracker-service.ts";
import { FellowshipServicesLive } from "@/layers/fellowship-layer.ts";
import { LiveSplitServicesLive } from "@/layers/live-split-layer.ts";
import { NodePlatformLive } from "@/layers/node-platform-layer.ts";
import { makePersistenceLayer } from "@/layers/persistence-layer.ts";
import { DungeonRunWebSocketBroadcasterLive } from "@/services/api/websocket-broadcaster-service.ts";
import { AppSettingsLive } from "@/services/app-settings/app-settings-service.ts";
import { LiveSplitFileLive } from "@/services/live-split/files/live-split-file-service.ts";
import { type DatabaseOptions } from "@/types/app-options.ts";

export type MakeAutosplitRuntimeOptions = DatabaseOptions;

export function makeAutosplitRuntime(options: MakeAutosplitRuntimeOptions) {
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

  const AutosplitLive = Layer.mergeAll(
    NodePlatformLive,
    PersistenceLive,
    FellowshipTrackerWithDependenciesLive,
    LiveSplitWithDependenciesLive,
    LiveSplitFileLive,
  );

  return ManagedRuntime.make(AutosplitLive);
}

export type MakeGenerateLSSRuntimeOptions = DatabaseOptions;

export function makeGenerateLSSRuntime(options: MakeGenerateLSSRuntimeOptions) {
  const PersistenceLive = makePersistenceLayer(options);

  const GenerateLSSLive = Layer.mergeAll(
    NodePlatformLive,
    PersistenceLive,
    LiveSplitFileLive,
  );

  return ManagedRuntime.make(GenerateLSSLive);
}
