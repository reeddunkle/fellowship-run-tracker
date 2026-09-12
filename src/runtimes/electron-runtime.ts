import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";

import { makeAppStateStorageLive } from "@/electron/storage/app-state/app-state-storage-live.ts";
import { type MakeApiLayerOptions, makeApiLayer } from "@/layers/api-layer.ts";
import {
  NodePathLive,
  NodePlatformLive,
} from "@/layers/node-platform-layer.ts";
import { ElectronAppStateLive } from "@/services/app-state/electron-app-state-live.ts";

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

  const AppStateLive = ElectronAppStateLive.pipe(
    Layer.provide(AppStateStorageLive),
  );

  const ElectronServicesLive = Layer.mergeAll(AppStateLive, NodePathLive);

  const ElectronLive = Layer.mergeAll(ApiLive, ElectronServicesLive);

  return ManagedRuntime.make(ElectronLive);
}
