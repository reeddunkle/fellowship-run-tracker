import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as Crypto from "effect/Crypto";
import type * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { DungeonRunHistory } from "@frt/api/services/dungeon-run-history/dungeon-run-history-service.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { DungeonRunStore } from "@frt/db/stores/dungeon-run/dungeon-run-store.ts";
import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { type RequirementEventType } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

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

  const layer = Layer.mergeAll(
    PersistenceTestLive,
    DungeonRunHistoryTestLive,
    NodeCrypto.layer,
  );

  return {
    layer,
  };
}

const SEED_FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(1);

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

export const seedDungeonRunWithObservations = E.fnUntraced(function* ({
  dungeonId,
  dungeonLevel,
  isOwnRun,
  observations,
  startedAt,
}: SeedDungeonRunOptions) {
  const dungeonRunStore = yield* DungeonRunStore;

  if (!isOwnRun) {
    const crypto = yield* Crypto.Crypto;
    const reportCode = yield* Schema.decodeEffect(
      FellowshipLogsReportCodeSchema,
    )(yield* crypto.randomUUIDv4({ format: "hex" }).pipe(E.orDie));

    return yield* dungeonRunStore.importFellowshipLogs({
      dungeonId,
      dungeonLevel,
      endedAt: startedAt,
      fightId: SEED_FIGHT_ID,
      isOwnRun,
      observations,
      reportCode,
      startedAt,
    });
  }

  const dungeonRun = yield* dungeonRunStore.createLocal({
    dungeonId,
    dungeonLevel,
  });

  yield* dungeonRunStore.startLocal({
    dungeonRunId: dungeonRun.id,
    startedAt,
  });

  yield* dungeonRunStore.observeLocal({
    dungeonRunId: dungeonRun.id,
    observations,
  });

  return dungeonRun;
});
