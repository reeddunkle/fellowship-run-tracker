import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";

import { makeApiLayer } from "@/layers/api-layer.ts";
import { NodePathLayer } from "@/layers/node-platform-layer.ts";
import { makePersistenceLayer } from "@/layers/persistence-layer.ts";
import { makeAppStateApiServiceLayer } from "@/services/api/app-state/app-state-api-service-layer.ts";
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
  const PersistenceLayer = makePersistenceLayer({
    databaseFilename,
  });

  const ApiLayer = makeApiLayer({
    encryptionKeyDirectory,
  }).pipe(Layer.provide(PersistenceLayer));

  const AppStateLayer = makeAppStateApiServiceLayer(appStateStorageDirectory);

  const ElectronLayer = Layer.mergeAll(ApiLayer, AppStateLayer, NodePathLayer);

  return ManagedRuntime.make(ElectronLayer);
}
