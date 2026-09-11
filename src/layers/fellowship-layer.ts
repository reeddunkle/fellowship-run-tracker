import * as Layer from "effect/Layer";

import { FileMonitoringLive } from "@/layers/file-monitor-layer.ts";
import { FellowshipLive } from "@/services/fellowship/fellowship-service.ts";

export const FellowshipServicesLive = FellowshipLive.pipe(
  Layer.provide(FileMonitoringLive),
);
