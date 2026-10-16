import * as Layer from "effect/Layer";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { FellowshipLogsGateway } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import {
  type FellowshipLogsFetchControl,
  makeControlledFellowshipLogsFixtureLayer,
} from "@frt/api/tests/common/layers/controlled-fellowship-logs-fixture-layer.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";

export type MakeFellowshipLogsDungeonRunImporterIntegrationTestHarnessOptions =
  {
    readonly databaseFilename?: string;
    readonly fellowshipLogsFetchControl?: FellowshipLogsFetchControl;
  };

export function makeFellowshipLogsDungeonRunImporterIntegrationTestHarness({
  databaseFilename = ":memory:",
  fellowshipLogsFetchControl,
}: MakeFellowshipLogsDungeonRunImporterIntegrationTestHarnessOptions = {}) {
  const PersistenceTestLive = makePersistenceTestLayer(databaseFilename);

  const FellowshipLogsGatewayFixtureLive =
    fellowshipLogsFetchControl === undefined
      ? FellowshipLogsGateway.fixtureLayer
      : makeControlledFellowshipLogsFixtureLayer(fellowshipLogsFetchControl);

  const FellowshipLogsFixtureTestLive = FellowshipLogsGatewayFixtureLive.pipe(
    Layer.provide(PersistenceTestLive),
  );

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
