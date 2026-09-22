import * as Layer from "effect/Layer";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";

import { AppStateStorage, makeAppStateStorage } from "./app-state-storage.ts";

export function makeAppStateStorageLayer(directoryPath: string) {
  return Layer.effect(AppStateStorage, makeAppStateStorage).pipe(
    Layer.provide(KeyValueStore.layerFileSystem(directoryPath)),
    Layer.provide(NodePlatformLayer),
  );
}
