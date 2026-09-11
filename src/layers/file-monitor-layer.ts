import * as Layer from "effect/Layer";

import { NodePlatformLive } from "@/layers/node-platform-layer.ts";
import { FileMonitorLive } from "@/services/filesystem/file-monitor-service.ts";
import { FileMonitorSourceLive } from "@/services/filesystem/file-monitor-source-service.ts";

const FileMonitorSourceWithPlatformLive = FileMonitorSourceLive.pipe(
  Layer.provide(NodePlatformLive),
);

const FileMonitorWithDependenciesLive = FileMonitorLive.pipe(
  Layer.provide(
    Layer.mergeAll(FileMonitorSourceWithPlatformLive, NodePlatformLive),
  ),
);

export const FileMonitoringLive = Layer.mergeAll(
  FileMonitorSourceWithPlatformLive,
  FileMonitorWithDependenciesLive,
);
