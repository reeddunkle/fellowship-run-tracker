import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";

import { makeAppStateStorageLive } from "@/electron/storage/app-state/app-state-storage-live.ts";
import { makeApiLayer } from "@/layers/api-layer.ts";
import { makeEncryptionLayer } from "@/layers/encryption-layer.ts";
import {
  NodePathLive,
  NodePlatformLive,
} from "@/layers/node-platform-layer.ts";
import { makePersistenceLayer } from "@/layers/persistence-layer.ts";
import { AppStateApiServiceLive } from "@/services/api/app-state/app-state-api-service-live.ts";
import { type DatabaseOptions } from "@/types/app-options.ts";

export type MakeElectronRuntimeOptions = DatabaseOptions & {
  readonly appStateStorageDirectory: string;
  readonly encryptionKeyDirectory: string;
};

export function makeElectronRuntime({
  appStateStorageDirectory,
  databaseFilename,
  encryptionKeyDirectory,
}: MakeElectronRuntimeOptions) {
  const PersistenceLive = makePersistenceLayer({
    databaseFilename,
  });

  const EncryptionLive = makeEncryptionLayer({
    encryptionKeyDirectory,
  });

  const ApiLive = makeApiLayer().pipe(
    Layer.provide(Layer.mergeAll(PersistenceLive, EncryptionLive)),
  );

  const AppStateStorageLive = makeAppStateStorageLive(
    appStateStorageDirectory,
  ).pipe(Layer.provide(NodePlatformLive));

  const AppStateLive = AppStateApiServiceLive.pipe(
    Layer.provide(AppStateStorageLive),
  );

  const ElectronLive = Layer.mergeAll(ApiLive, AppStateLive, NodePathLive);

  return ManagedRuntime.make(ElectronLive);
}
