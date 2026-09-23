import * as Layer from "effect/Layer";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { FellowshipLogs } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";

export type MakeFellowshipLogsDungeonRunImporterIntegrationTestHarnessOptions =
  {
    readonly databaseFilename?: string;
  };

export function makeFellowshipLogsDungeonRunImporterIntegrationTestHarness({
  databaseFilename = ":memory:",
}: MakeFellowshipLogsDungeonRunImporterIntegrationTestHarnessOptions = {}) {
  const PersistenceTestLive = makePersistenceTestLayer(databaseFilename);

  const FellowshipLogsFixtureTestLive = FellowshipLogs.fixtureLayer;

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
