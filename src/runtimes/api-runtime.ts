import * as ManagedRuntime from "effect/ManagedRuntime";

import { type MakeApiLayerOptions, makeApiLayer } from "@/layers/api-layer.ts";

export type MakeApiRuntimeOptions = MakeApiLayerOptions;

export function makeApiRuntime(options: MakeApiRuntimeOptions) {
  return ManagedRuntime.make(makeApiLayer(options));
}
