import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";

import { NodePathLayer } from "@frt/api/layers/node-platform-layer.ts";
import { AppLoggerLayer } from "@frt/api/services/logging/app-logger-service.ts";

/**
 * Shared by the startup and Electron runtimes so they reuse a single
 * `AppLoggerLayer` instance (and log file handle) instead of each building
 * their own.
 */
export const runtimeMemoMap = Layer.makeMemoMapUnsafe();

/**
 * Runs the main process startup that happens before the Electron runtime's
 * layers can be built, so failures there — including the Electron runtime
 * itself failing to build — are written to the log file.
 */
export const startupRuntime = ManagedRuntime.make(
  Layer.mergeAll(AppLoggerLayer, NodePathLayer),
  {
    memoMap: runtimeMemoMap,
  },
);
