import type * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { DungeonRunDAO } from "@/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { DungeonRunApiServiceLive } from "@/services/api/dungeon-run/dungeon-run-api-service.ts";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";
import { makePersistenceTestLayer } from "@/tests/common/layers/persistence-test-layer.ts";

export type MakeDungeonRunApiServiceIntegrationTestHarnessOptions = {
  readonly databaseFilename?: string;
};

export function makeDungeonRunApiServiceIntegrationTestHarness({
  databaseFilename = ":memory:",
}: MakeDungeonRunApiServiceIntegrationTestHarnessOptions = {}) {
  const PersistenceTestLive = makePersistenceTestLayer(databaseFilename);

  const DungeonRunApiServiceTestLive = DungeonRunApiServiceLive.pipe(
    Layer.provide(PersistenceTestLive),
  );

  const layer = Layer.mergeAll(
    PersistenceTestLive,
    DungeonRunApiServiceTestLive,
  );

  return {
    layer,
  };
}

type SeedDungeonRunObservation = {
  readonly observedAt: DateTime.Utc;
  readonly targetId: string;
  readonly type: RequirementEventType;
};

export type SeedDungeonRunOptions = {
  readonly dungeonId: DungeonId;
  readonly dungeonLevel: number;
  readonly isOwnRun: boolean;
  readonly observations: ReadonlyArray<SeedDungeonRunObservation>;
  readonly startedAt: DateTime.Utc;
};

export const seedDungeonRunWithObservations = E.fn(
  "test.seed-dungeon-run-with-observations",
)(function* ({
  dungeonId,
  dungeonLevel,
  isOwnRun,
  observations,
  startedAt,
}: SeedDungeonRunOptions) {
  const dungeonRunDAO = yield* DungeonRunDAO;
  const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;

  const dungeonRun = yield* dungeonRunDAO.create({
    dungeonId,
    dungeonLevel,
    endedAt: null,
    isOwnRun,
    source: "LOCAL_LOG",
    startedAt: null,
  });

  yield* dungeonRunDAO.start({
    dungeonRunId: dungeonRun.id,
    startedAt,
  });

  yield* E.forEach(
    observations,
    (observation) => {
      return dungeonRunObservationDAO.observe({
        dungeonRunId: dungeonRun.id,
        observedAt: observation.observedAt,
        targetId: observation.targetId,
        type: observation.type,
      });
    },
    { discard: true },
  );

  return dungeonRun;
});
