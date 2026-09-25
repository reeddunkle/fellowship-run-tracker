import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { app } from "electron";

import { appPaths } from "@frt/api/helpers/app-paths.ts";
import { getDatabaseOptions } from "@frt/api/helpers/get-database-options.ts";
import { ApiLayer } from "@frt/api/layers/api-layer.ts";
import { NodePathLayer } from "@frt/api/layers/node-platform-layer.ts";
import { makePersistenceLayer } from "@frt/api/layers/persistence-layer.ts";
import { logCause } from "@frt/api/logging/log-cause.ts";
import { AppLoggerLayer } from "@frt/api/services/logging/app-logger-service.ts";

import { makeAppStateLayer } from "@/services/app-state/app-state-service-layer.ts";
import { WindowState } from "@/services/window-state/window-state-service.ts";

const ElectronApplicationLayer = Layer.unwrap(
  E.gen(function* () {
    yield* E.promise(() => app.whenReady());

    const databaseOptions = yield* getDatabaseOptions();

    return Layer.mergeAll(
      ApiLayer.pipe(Layer.provide(makePersistenceLayer(databaseOptions))),
      makeAppStateLayer(appPaths.appState),
      WindowState.layerWith(appPaths.appState),
    );
  }),
);

const ElectronLayer = ElectronApplicationLayer.pipe(
  Layer.tapCause(logCause),
  Layer.provideMerge(Layer.mergeAll(AppLoggerLayer, NodePathLayer)),
);

export const electronRuntime = ManagedRuntime.make(ElectronLayer);
