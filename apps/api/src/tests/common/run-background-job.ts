import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { type BackgroundJobPayload } from "@frt/api/services/background-job-queue/background-job-payload-schema.ts";
import { BackgroundJobRunner } from "@frt/api/services/background-job-runner/background-job-runner-service.ts";
import { IgnoredFellowshipLogsImportCostLayer } from "@frt/api/tests/common/mocks/fellowship-logs-import-cost-mock.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";

const TEST_JOB_ID = Schema.decodeSync(BackgroundJobIdSchema)(
  "0190a5f2-0000-7000-8000-000000000001",
);

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
    Layer.mergeAll(
      IgnoredFellowshipLogsImportCostLayer,
      UnusedFellowshipLogsDungeonRunImporter,
      NodePlatformLayer,
    ),
  ),
);

export function runBackgroundJob(job: BackgroundJobPayload) {
  return BackgroundJobRunner.use((backgroundJobRunner) => {
    return backgroundJobRunner.run(job, {
      bindingKey: null,
      jobId: TEST_JOB_ID,
      reportProgress: () => E.void,
    });
  }).pipe(E.provide(BackgroundJobRunnerTestLayer));
}
