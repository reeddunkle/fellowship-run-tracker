import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";

import { makeAppStateStorageLive } from "@/electron/storage/app-state/app-state-storage-live.ts";
import { type MakeApiLayerOptions, makeApiLayer } from "@/layers/api-layer.ts";
import {
  NodePathLive,
  NodePlatformLive,
} from "@/layers/node-platform-layer.ts";
import { ElectronAppStateUpdateWorkerLive } from "@/services/app-state/app-state-update-worker/electron-app-state-update-worker-live.ts";

export type MakeElectronRuntimeOptions = MakeApiLayerOptions & {
  readonly appStateStorageDirectory: string;
};

export function makeElectronRuntime({
  appStateStorageDirectory,
  ...apiOptions
}: MakeElectronRuntimeOptions) {
  const ApiLive = makeApiLayer(apiOptions);

  const AppStateStorageLive = makeAppStateStorageLive(
    appStateStorageDirectory,
  ).pipe(Layer.provide(NodePlatformLive));

  const AppStateUpdateWorkerLive = ElectronAppStateUpdateWorkerLive.pipe(
    Layer.provide(AppStateStorageLive),
  );

  const ElectronServicesLive = Layer.mergeAll(
    AppStateStorageLive,
    AppStateUpdateWorkerLive,
    NodePathLive,
  );

  const ElectronLive = Layer.mergeAll(ApiLive, ElectronServicesLive);

  return ManagedRuntime.make(ElectronLive);
}
