import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { type BackgroundJobPayload } from "@frt/api/services/background-job-queue/background-job-payload-schema.ts";
import { BackgroundJobRunner } from "@frt/api/services/background-job-runner/background-job-runner-service.ts";

const UnusedFellowshipLogsDungeonRunImporter = Layer.succeed(
  FellowshipLogsDungeonRunImporter,
  {
    importReport: () => {
      return E.die("unexpected call: importReport");
    },
  },
);

const BackgroundJobRunnerTestLayer = BackgroundJobRunner.layerNoDeps.pipe(
  Layer.provide(
    Layer.merge(UnusedFellowshipLogsDungeonRunImporter, NodePlatformLayer),
  ),
);

export function runBackgroundJob(job: BackgroundJobPayload) {
  return BackgroundJobRunner.use((backgroundJobRunner) => {
    return backgroundJobRunner.run(job, { reportProgress: () => E.void });
  }).pipe(E.provide(BackgroundJobRunnerTestLayer));
}
