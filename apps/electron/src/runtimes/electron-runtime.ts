import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";

import { makeApiLayer } from "@frt/api/layers/api-layer.ts";
import { NodePathLayer } from "@frt/api/layers/node-platform-layer.ts";
import { makePersistenceLayer } from "@frt/api/layers/persistence-layer.ts";
import { AppLoggerLayer } from "@frt/api/services/logging/app-logger-service.ts";
import { type DatabaseOptions } from "@frt/db/types/database-options.ts";

import { runtimeMemoMap } from "@/runtimes/startup-runtime.ts";
import { makeAppStateApiServiceLayer } from "@/services/app-state/app-state-api-service-layer.ts";

export type MakeElectronRuntimeOptions = DatabaseOptions & {
  readonly appStateStorageDirectory: string;
  readonly backgroundJobsDirectory: string;
  readonly encryptionKeyDirectory: string;
};

export function makeElectronRuntime({
  appStateStorageDirectory,
  backgroundJobsDirectory,
  databaseFilename,
  encryptionKeyDirectory,
}: MakeElectronRuntimeOptions) {
  const PersistenceLayer = makePersistenceLayer({
    databaseFilename,
  });

  const ApiLayer = makeApiLayer({
    backgroundJobsDirectory,
    encryptionKeyDirectory,
  }).pipe(Layer.provide(PersistenceLayer));

  const AppStateLayer = makeAppStateApiServiceLayer(appStateStorageDirectory);

  const ElectronLayer = Layer.mergeAll(
    ApiLayer,
    AppStateLayer,
    NodePathLayer,
  ).pipe(Layer.provideMerge(AppLoggerLayer));

  return ManagedRuntime.make(ElectronLayer, {
    memoMap: runtimeMemoMap,
  });
}
