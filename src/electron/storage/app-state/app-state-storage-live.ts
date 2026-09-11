import * as Layer from "effect/Layer";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";

import { AppStateStorage, makeAppStateStorage } from "./app-state-storage.ts";

export function makeAppStateStorageLive(directoryPath: string) {
  const KeyValueStoreLive = KeyValueStore.layerFileSystem(directoryPath);

  return Layer.effect(AppStateStorage, makeAppStateStorage).pipe(
    Layer.provide(KeyValueStoreLive),
  );
}
