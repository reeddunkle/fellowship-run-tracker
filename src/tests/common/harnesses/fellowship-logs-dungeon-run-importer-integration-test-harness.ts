import * as Layer from "effect/Layer";

import { FellowshipLogsDungeonRunImporter } from "@/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { FELLOWSHIP_LOGS_FIXTURE_DIRECTORY } from "@/services/fellowship-logs/fellowship-logs-fixture-paths.ts";
import { FellowshipLogs } from "@/services/fellowship-logs/fellowship-logs-service.ts";
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

  const FellowshipLogsFixtureTestLive = FellowshipLogs.fixtureLayerWith({
    fixtureDirectory,
  });

  const FellowshipLogsDungeonRunImporterTestLive =
    FellowshipLogsDungeonRunImporter.layerNoDeps.pipe(
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
