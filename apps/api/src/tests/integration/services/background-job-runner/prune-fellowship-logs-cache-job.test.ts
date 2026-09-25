import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { type BackgroundJobPayload } from "@frt/api/services/background-job-queue/background-job-payload-schema.ts";
import { BackgroundJobRunner } from "@frt/api/services/background-job-runner/background-job-runner-service.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsResponseDAO } from "@frt/db/daos/fellowship-logs-response/fellowship-logs-response-dao.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

const REPORT_CODE = Schema.decodeSync(FellowshipLogsReportCodeSchema)("report");

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

function runJob(job: BackgroundJobPayload) {
  return BackgroundJobRunner.use((backgroundJobRunner) => {
    return backgroundJobRunner.run(job, { reportProgress: () => E.void });
  }).pipe(E.provide(BackgroundJobRunnerTestLayer));
}

const putResponse = E.fn("test.put-fellowship-logs-response")(function* (
  key: string,
  expiresAt: DateTime.Utc | null,
) {
  const responseDAO = yield* FellowshipLogsResponseDAO;

  yield* responseDAO.put({
    body: new Uint8Array(8),
    expiresAt,
    fightId: null,
    key,
    operation: "FIGHT",
    reportCode: REPORT_CODE,
    reportRevision: null,
  });
});

describe("PruneFellowshipLogsCache job", () => {
  test("drops expired responses and keeps the rest", async () => {
    const remaining = await E.gen(function* () {
      const responseDAO = yield* FellowshipLogsResponseDAO;
      const now = yield* DateTime.now;

      yield* putResponse("expired", DateTime.subtract(now, { minutes: 1 }));
      yield* putResponse("kept-indefinitely", null);

      yield* runJob({ _tag: "PruneFellowshipLogsCache" });

      return {
        expired: yield* responseDAO.get({ key: "expired" }),
        keptIndefinitely: yield* responseDAO.get({ key: "kept-indefinitely" }),
      };
    }).pipe(E.provide(makePersistenceTestLayer()), runTest);

    expect(Option.isNone(remaining.expired)).toBe(true);
    expect(Option.isSome(remaining.keptIndefinitely)).toBe(true);
  });
});
