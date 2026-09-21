import * as Layer from "effect/Layer";

import { FellowshipTracker } from "@/application/fellowship-tracker/fellowship-tracker-service.ts";
import { LiveSplit } from "@/services/live-split/core/live-split-service.ts";
import { LiveSplitFile } from "@/services/live-split/files/live-split-file-service.ts";

export type MakeAutosplitLayerOptions = {
  readonly encryptionKeyDirectory: string;
};

export function makeAutosplitLayer(options: MakeAutosplitLayerOptions) {
  return Layer.mergeAll(
    FellowshipTracker.layerWith(options),
    LiveSplit.layerWith(options),
    LiveSplitFile.layer,
  );
}
