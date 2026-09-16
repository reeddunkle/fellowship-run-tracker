import * as Layer from "effect/Layer";

import { DungeonRunDAOLive } from "@/db/daos/dungeon-run/dungeon-run-dao-live.ts";
import { DungeonRunObservationDAOLive } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao-live.ts";
import { LocalLogDungeonRunDAOLive } from "@/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao-live.ts";
import { FellowshipLogsDungeonRunDAOLive } from "@/db/fellowship-logs-dungeon-run/fellowship-logs-dungeon-run-dao-live.ts";
import { DungeonRunRepositoryLive } from "@/services/dungeon-run-repository/dungeon-run-repository-service-live.ts";

const DungeonRunDAOsLive = Layer.mergeAll(
  DungeonRunDAOLive,
  DungeonRunObservationDAOLive,
  FellowshipLogsDungeonRunDAOLive,
  LocalLogDungeonRunDAOLive,
);

export const DungeonRunRepositoryWithDependenciesLive =
  DungeonRunRepositoryLive.pipe(Layer.provideMerge(DungeonRunDAOsLive));
