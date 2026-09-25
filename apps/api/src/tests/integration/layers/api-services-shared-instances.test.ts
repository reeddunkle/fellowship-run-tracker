import * as ConfigProvider from "effect/ConfigProvider";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { ApiServicesLayer } from "@frt/api/layers/api-services-layer.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { BackgroundJobService } from "@frt/api/services/background-job/background-job-service.ts";
import { EncryptionKeyDirectory } from "@frt/api/services/encryption/encryption-key-directory.ts";
import { FellowshipLogs } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { MOCK_DUNGEON_ID } from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

const FixtureModeConfigLayer = ConfigProvider.layerAdd(
  ConfigProvider.fromUnknown({ FELLOWSHIP_LOGS_USE_FIXTURES: "true" }),
);

/*
 * Builds the API services the same way the application root does, so this
 * catches layers that quietly construct a second copy of a shared service.
 */
describe("API services layer", () => {
  test("shows rate limit data spent by a background import", async () => {
    const rateLimitData = await E.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const directory = yield* fileSystem.makeTempDirectoryScoped();
      const ApiServicesTestLayer = ApiServicesLayer.pipe(
        Layer.provideMerge(BackgroundJobService.layer),
        Layer.provideMerge(
          makePersistenceTestLayer(path.join(directory, "database.db")),
        ),
        Layer.provide(FixtureModeConfigLayer),
        Layer.provide(
          Layer.succeed(
            EncryptionKeyDirectory,
            path.join(directory, "security"),
          ),
        ),
      );

      return yield* E.gen(function* () {
        const backgroundJobService = yield* BackgroundJobService;
        const fellowshipLogs = yield* FellowshipLogs;

        const { job } = yield* backgroundJobService.offer({
          _tag: "ImportFellowshipLogsDungeonRun",
          dungeonId: MOCK_DUNGEON_ID,
          dungeonLevel: 10,
          fightId: Schema.decodeSync(FellowshipLogsFightIdSchema)(15),
          isOwnRun: true,
          reportCode: Schema.decodeSync(FellowshipLogsReportCodeSchema)(
            "XdfFZzgHBJNr6m3v",
          ),
        });

        yield* BackgroundJobDAO.use((dao) => {
          return dao.getById({ id: job.id });
        }).pipe(
          E.repeat({
            schedule: Schedule.spaced("10 millis"),
            until: (row) => {
              return Option.isSome(row) && row.value.status === "SUCCEEDED";
            },
          }),
          E.timeout("10 seconds"),
        );

        return yield* fellowshipLogs.getLastKnownRateLimitData();
      }).pipe(E.provide(ApiServicesTestLayer));
    }).pipe(E.scoped, E.provide(NodePlatformLayer), runTest);

    expect(rateLimitData).not.toBeNull();
  });
});
