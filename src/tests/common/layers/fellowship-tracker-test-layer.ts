import * as Layer from "effect/Layer";

import { FellowshipTrackerLive } from "@/application/fellowship-tracker/fellowship-tracker-service.ts";
import { type ConfigurationDAO } from "@/db/daos/configuration/configuration-dao.ts";
import { type DungeonRunDAO } from "@/db/daos/dungeon-run/dungeon-run-dao.ts";
import { type DungeonRunObservationDAO } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { type DungeonRunWebSocketBroadcaster } from "@/services/api/websocket-broadcaster-service.ts";
import { type Fellowship } from "@/services/fellowship/fellowship-service.ts";
import { type LiveSplit } from "@/services/live-split/core/live-split-service.ts";

type FellowshipTrackerDependencies =
  | ConfigurationDAO
  | DungeonRunDAO
  | DungeonRunObservationDAO
  | DungeonRunWebSocketBroadcaster
  | Fellowship
  | LiveSplit;

export function makeFellowshipTrackerTestLayer<E, R>(
  dependencies: Layer.Layer<FellowshipTrackerDependencies, E, R>,
) {
  return FellowshipTrackerLive.pipe(Layer.provide(dependencies));
}
