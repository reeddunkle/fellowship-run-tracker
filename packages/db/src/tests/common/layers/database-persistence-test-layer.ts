import * as Layer from "effect/Layer";

import { DungeonRunDAO } from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { FellowshipLogsDungeonRunDAO } from "@frt/db/daos/fellowship-logs-dungeon-run/fellowship-logs-dungeon-run-dao.ts";
import { LocalLogDungeonRunDAO } from "@frt/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import { makeDatabasePersistenceLayer } from "@frt/db/database-persistence-layer.ts";
import { makeTestDatabaseOptions } from "@frt/db/tests/common/make-test-database-options.ts";

const DungeonRunDAOsLayer = Layer.mergeAll(
  DungeonRunDAO.layer,
  DungeonRunObservationDAO.layer,
  FellowshipLogsDungeonRunDAO.layer,
  LocalLogDungeonRunDAO.layer,
);

export function makeDatabasePersistenceTestLayer(
  databaseFilename = ":memory:",
) {
  return DungeonRunDAOsLayer.pipe(
    Layer.provideMerge(
      makeDatabasePersistenceLayer(makeTestDatabaseOptions(databaseFilename)),
    ),
  );
}
