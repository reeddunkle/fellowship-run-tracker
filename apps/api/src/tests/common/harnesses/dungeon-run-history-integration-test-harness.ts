import type * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { DungeonRunHistory } from "@frt/api/services/dungeon-run-history/dungeon-run-history-service.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { DungeonRunDAO } from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { type RequirementEventType } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";

export type MakeDungeonRunHistoryIntegrationTestHarnessOptions = {
  readonly databaseFilename?: string;
};

export function makeDungeonRunHistoryIntegrationTestHarness({
  databaseFilename = ":memory:",
}: MakeDungeonRunHistoryIntegrationTestHarnessOptions = {}) {
  const PersistenceTestLive = makePersistenceTestLayer(databaseFilename);

  const DungeonRunHistoryTestLive = DungeonRunHistory.layer.pipe(
    Layer.provide(PersistenceTestLive),
  );

  const layer = Layer.mergeAll(PersistenceTestLive, DungeonRunHistoryTestLive);

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
