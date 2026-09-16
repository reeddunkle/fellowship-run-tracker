import * as Layer from "effect/Layer";

import { FellowshipLogsDungeonRunImporterLive } from "@/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service-live.ts";
import { NodePlatformLive } from "@/layers/node-platform-layer.ts";
import { makeFellowshipLogsFixtureLive } from "@/services/fellowship-logs/fellowship-logs-fixture-live.ts";
import { FELLOWSHIP_LOGS_FIXTURE_DIRECTORY } from "@/services/fellowship-logs/fellowship-logs-fixture-paths.ts";
import { makePersistenceTestLayer } from "@/tests/common/layers/persistence-test-layer.ts";

export type MakeFellowshipLogsDungeonRunImporterIntegrationTestHarnessOptions =
  {
    readonly databaseFilename?: string;
    readonly fixtureDirectory?: string;
  };

export function makeFellowshipLogsDungeonRunImporterIntegrationTestHarness({
  databaseFilename = ":memory:",
  fixtureDirectory = FELLOWSHIP_LOGS_FIXTURE_DIRECTORY,
}: MakeFellowshipLogsDungeonRunImporterIntegrationTestHarnessOptions = {}) {
  const PersistenceTestLive = makePersistenceTestLayer(databaseFilename);

  const FellowshipLogsFixtureTestLive = makeFellowshipLogsFixtureLive({
    fixtureDirectory,
  }).pipe(Layer.provide(NodePlatformLive));

  const FellowshipLogsDungeonRunImporterTestLive =
    FellowshipLogsDungeonRunImporterLive.pipe(
      Layer.provide(
        Layer.merge(PersistenceTestLive, FellowshipLogsFixtureTestLive),
      ),
    );

  const layer = Layer.mergeAll(
    PersistenceTestLive,
    FellowshipLogsFixtureTestLive,
    FellowshipLogsDungeonRunImporterTestLive,
  );

  return {
    layer,
  };
}
