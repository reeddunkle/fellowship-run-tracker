import * as Layer from "effect/Layer";

import { makePersistenceLayer } from "@/layers/persistence-layer.ts";
import { LiveSplitFileLive } from "@/services/live-split/files/live-split-file-service.ts";
import { type DatabaseOptions } from "@/types/app-options.ts";

export type MakeGenerateLSSLayerOptions = DatabaseOptions;

export function makeGenerateLSSLayer(options: MakeGenerateLSSLayerOptions) {
  const PersistenceLive = makePersistenceLayer(options);

  return Layer.mergeAll(PersistenceLive, LiveSplitFileLive);
}
