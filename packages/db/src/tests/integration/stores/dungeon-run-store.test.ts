import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { DungeonRunObservationDAOError } from "@frt/db/errors/dungeon-run-observation-dao-error.ts";
import { LocalLogDungeonRunDAOError } from "@frt/db/errors/local-log-dungeon-run-dao-error.ts";
import { DungeonRunStore } from "@frt/db/stores/dungeon-run/dungeon-run-store.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import {
  MOCK_DUNGEON_RUN_ENDED_AT,
  MOCK_DUNGEON_RUN_STARTED_AT,
} from "@frt/db/tests/common/fixtures/dungeon-run-fixtures.ts";
import { getSome } from "@frt/db/tests/common/get-some.ts";
import { makeDatabasePersistenceTestLayer } from "@frt/db/tests/common/layers/database-persistence-test-layer.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

const FIRST_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:00:10.000Z");

const SECOND_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:00:20.000Z");

const LATER_ENDED_AT = DateTime.makeUnsafe("2026-09-05T16:45:00.000Z");

const MISSING_DUNGEON_RUN_ID = Schema.decodeSync(DungeonRunIdSchema)(
  "00000000-0000-7000-8000-000000000000",
);

const REPORT_CODE = Schema.decodeSync(FellowshipLogsReportCodeSchema)(
  "report-a",
);

const FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(15);

const createStartedLocalRun = E.fnUntraced(function* () {
  const dungeonRunStore = yield* DungeonRunStore;

  const dungeonRun = yield* dungeonRunStore.createLocal({
    dungeonId: MOCK_DUNGEON_ID,
    dungeonLevel: MOCK_DUNGEON_LEVEL,
  });

  yield* dungeonRunStore.startLocal({
    dungeonRunId: dungeonRun.id,
    startedAt: MOCK_DUNGEON_RUN_STARTED_AT,
  });

  return dungeonRun;
});

const getCreatedBeforeNow = E.fnUntraced(function* () {
  const now = yield* DateTime.now;

  return DateTime.add(now, { seconds: 1 });
});

describe("DungeonRunStore", () => {
  describe("local run lifecycle", () => {
    test("creates an active local run that has not started", async () => {
      const program = E.gen(function* () {
        const dungeonRunStore = yield* DungeonRunStore;

        const dungeonRun = yield* dungeonRunStore.createLocal({
          dungeonId: MOCK_DUNGEON_ID,
          dungeonLevel: MOCK_DUNGEON_LEVEL,
        });

        const localRun = getSome(
          yield* dungeonRunStore.getLocal({ dungeonRunId: dungeonRun.id }),
        );

        expect(localRun.status).toBe("ACTIVE");
        expect(localRun.dungeonRun).toMatchObject({
          endedAt: null,
          isOwnRun: true,
          source: "LOCAL_LOG",
          startedAt: null,
        });
      }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

      await runTest(program);
    });

    describe.each([
      { status: "COMPLETED" },
      { status: "EXITED" },
      { status: "INTERRUPTED" },
    ] as const)("finishing with $status", ({ status }) => {
      test("records the status, start, and end", async () => {
        const program = E.gen(function* () {
          const dungeonRunStore = yield* DungeonRunStore;
          const dungeonRun = yield* createStartedLocalRun();

          yield* dungeonRunStore.finishLocal({
            dungeonRunId: dungeonRun.id,
            endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
            status,
          });

          const localRun = getSome(
            yield* dungeonRunStore.getLocal({ dungeonRunId: dungeonRun.id }),
          );

          expect(localRun.status).toBe(status);
          expect(localRun.dungeonRun).toMatchObject({
            endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
            startedAt: MOCK_DUNGEON_RUN_STARTED_AT,
          });
        }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

        await runTest(program);
      });

      test("does not finish a run that has already finished", async () => {
        const program = E.gen(function* () {
          const dungeonRunStore = yield* DungeonRunStore;
          const dungeonRun = yield* createStartedLocalRun();

          yield* dungeonRunStore.finishLocal({
            dungeonRunId: dungeonRun.id,
            endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
            status: "COMPLETED",
          });

          const error = yield* dungeonRunStore
            .finishLocal({
              dungeonRunId: dungeonRun.id,
              endedAt: LATER_ENDED_AT,
              status,
            })
            .pipe(E.flip);

          expect(error).toBeInstanceOf(LocalLogDungeonRunDAOError);
          expect(error).toMatchObject({
            reason: {
              _tag: "DungeonRunNotFoundOrInactiveError",
              dungeonRunId: dungeonRun.id,
            },
          });

          const localRun = getSome(
            yield* dungeonRunStore.getLocal({ dungeonRunId: dungeonRun.id }),
          );

          expect(localRun.status).toBe("COMPLETED");
          expect(localRun.dungeonRun.endedAt).toEqual(
            MOCK_DUNGEON_RUN_ENDED_AT,
          );
        }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

        await runTest(program);
      });
    });

    test("finds no local run for a Fellowship Logs run", async () => {
      const program = E.gen(function* () {
        const dungeonRunStore = yield* DungeonRunStore;

        const dungeonRun = yield* dungeonRunStore.importFellowshipLogs({
          dungeonId: MOCK_DUNGEON_ID,
          dungeonLevel: MOCK_DUNGEON_LEVEL,
          endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
          fightId: FIGHT_ID,
          isOwnRun: false,
          observations: [],
          reportCode: REPORT_CODE,
          startedAt: MOCK_DUNGEON_RUN_STARTED_AT,
        });

        const localRun = yield* dungeonRunStore.getLocal({
          dungeonRunId: dungeonRun.id,
        });

        expect(localRun).toEqual(Option.none());
      }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

      await runTest(program);
    });
  });

  describe("observeLocal", () => {
    test("writes a batch of observations into the run's history", async () => {
      const program = E.gen(function* () {
        const dungeonRunStore = yield* DungeonRunStore;
        const dungeonRun = yield* createStartedLocalRun();

        yield* dungeonRunStore.observeLocal({
          dungeonRunId: dungeonRun.id,
          observations: [
            {
              observedAt: FIRST_OBSERVED_AT,
              targetId: "42",
              type: "UNIT_DEATH",
            },
            {
              observedAt: SECOND_OBSERVED_AT,
              targetId: "634",
              type: "ABILITY_ACTIVATED",
            },
          ],
        });

        const history = yield* dungeonRunStore.getHistory({
          dungeonId: MOCK_DUNGEON_ID,
          dungeonLevel: MOCK_DUNGEON_LEVEL,
        });

        expect(history).toEqual([
          {
            dungeonRunId: dungeonRun.id,
            elapsedMilliseconds: 20_000,
            isOwnRun: true,
            occurrence: 1,
            targetId: "634",
            type: "ABILITY_ACTIVATED",
          },
          {
            dungeonRunId: dungeonRun.id,
            elapsedMilliseconds: 10_000,
            isOwnRun: true,
            occurrence: 1,
            targetId: "42",
            type: "UNIT_DEATH",
          },
        ]);
      }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

      await runTest(program);
    });

    test("does not observe a run that does not exist", async () => {
      const program = E.gen(function* () {
        const dungeonRunStore = yield* DungeonRunStore;

        const error = yield* dungeonRunStore
          .observeLocal({
            dungeonRunId: MISSING_DUNGEON_RUN_ID,
            observations: [
              {
                observedAt: FIRST_OBSERVED_AT,
                targetId: "42",
                type: "UNIT_DEATH",
              },
            ],
          })
          .pipe(E.flip);

        expect(error).toBeInstanceOf(DungeonRunObservationDAOError);
        expect(error).toMatchObject({
          reason: {
            _tag: "DungeonRunNotFoundError",
            dungeonRunId: MISSING_DUNGEON_RUN_ID,
          },
        });
      }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

      await runTest(program);
    });
  });

  describe("interruptUnfinishedLocal", () => {
    test("ends a run at its latest observation", async () => {
      const program = E.gen(function* () {
        const dungeonRunStore = yield* DungeonRunStore;
        const dungeonRun = yield* createStartedLocalRun();

        yield* dungeonRunStore.observeLocal({
          dungeonRunId: dungeonRun.id,
          observations: [
            {
              observedAt: SECOND_OBSERVED_AT,
              targetId: "42",
              type: "UNIT_DEATH",
            },
            {
              observedAt: FIRST_OBSERVED_AT,
              targetId: "634",
              type: "ABILITY_ACTIVATED",
            },
          ],
        });

        const interruptedIds = yield* dungeonRunStore.interruptUnfinishedLocal({
          createdBefore: yield* getCreatedBeforeNow(),
        });

        expect(interruptedIds).toEqual([dungeonRun.id]);

        const localRun = getSome(
          yield* dungeonRunStore.getLocal({ dungeonRunId: dungeonRun.id }),
        );

        expect(localRun.status).toBe("INTERRUPTED");
        expect(localRun.dungeonRun.endedAt).toEqual(SECOND_OBSERVED_AT);
      }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

      await runTest(program);
    });

    test("ends a run without observations at its start", async () => {
      const program = E.gen(function* () {
        const dungeonRunStore = yield* DungeonRunStore;
        const dungeonRun = yield* createStartedLocalRun();

        yield* dungeonRunStore.interruptUnfinishedLocal({
          createdBefore: yield* getCreatedBeforeNow(),
        });

        const localRun = getSome(
          yield* dungeonRunStore.getLocal({ dungeonRunId: dungeonRun.id }),
        );

        expect(localRun.status).toBe("INTERRUPTED");
        expect(localRun.dungeonRun.endedAt).toEqual(
          MOCK_DUNGEON_RUN_STARTED_AT,
        );
      }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

      await runTest(program);
    });

    test("ends a run that never started at its creation", async () => {
      const program = E.gen(function* () {
        const dungeonRunStore = yield* DungeonRunStore;

        const dungeonRun = yield* dungeonRunStore.createLocal({
          dungeonId: MOCK_DUNGEON_ID,
          dungeonLevel: MOCK_DUNGEON_LEVEL,
        });

        yield* dungeonRunStore.interruptUnfinishedLocal({
          createdBefore: yield* getCreatedBeforeNow(),
        });

        const localRun = getSome(
          yield* dungeonRunStore.getLocal({ dungeonRunId: dungeonRun.id }),
        );

        expect(localRun.status).toBe("INTERRUPTED");
        expect(localRun.dungeonRun.endedAt).toEqual(dungeonRun.createdAt);
      }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

      await runTest(program);
    });

    test("leaves finished runs and runs created after the cutoff alone", async () => {
      const program = E.gen(function* () {
        const dungeonRunStore = yield* DungeonRunStore;
        const finishedRun = yield* createStartedLocalRun();
        const recentRun = yield* createStartedLocalRun();

        yield* dungeonRunStore.finishLocal({
          dungeonRunId: finishedRun.id,
          endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
          status: "COMPLETED",
        });

        const interruptedIds = yield* dungeonRunStore.interruptUnfinishedLocal({
          createdBefore: MOCK_DUNGEON_RUN_STARTED_AT,
        });

        expect(interruptedIds).toEqual([]);

        const finishedLocalRun = getSome(
          yield* dungeonRunStore.getLocal({ dungeonRunId: finishedRun.id }),
        );

        const recentLocalRun = getSome(
          yield* dungeonRunStore.getLocal({ dungeonRunId: recentRun.id }),
        );

        expect(finishedLocalRun.status).toBe("COMPLETED");
        expect(recentLocalRun.status).toBe("ACTIVE");
      }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

      await runTest(program);
    });
  });

  describe("importFellowshipLogs", () => {
    test("imports a finished run with its observations", async () => {
      const program = E.gen(function* () {
        const dungeonRunStore = yield* DungeonRunStore;

        const dungeonRun = yield* dungeonRunStore.importFellowshipLogs({
          dungeonId: MOCK_DUNGEON_ID,
          dungeonLevel: MOCK_DUNGEON_LEVEL,
          endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
          fightId: FIGHT_ID,
          isOwnRun: false,
          observations: [
            {
              observedAt: FIRST_OBSERVED_AT,
              targetId: "42",
              type: "UNIT_DEATH",
            },
          ],
          reportCode: REPORT_CODE,
          startedAt: MOCK_DUNGEON_RUN_STARTED_AT,
        });

        const fellowshipLogsRun = getSome(
          yield* dungeonRunStore.getFellowshipLogsRun({
            fightId: FIGHT_ID,
            reportCode: REPORT_CODE,
          }),
        );

        expect(fellowshipLogsRun.dungeonRunId).toBe(dungeonRun.id);

        const history = yield* dungeonRunStore.getHistory({
          dungeonId: MOCK_DUNGEON_ID,
          dungeonLevel: MOCK_DUNGEON_LEVEL,
        });

        expect(history).toEqual([
          {
            dungeonRunId: dungeonRun.id,
            elapsedMilliseconds: 10_000,
            isOwnRun: false,
            occurrence: 1,
            targetId: "42",
            type: "UNIT_DEATH",
          },
        ]);
      }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

      await runTest(program);
    });
  });

  describe("deleteHistory", () => {
    test("deletes own runs and keeps other players' runs", async () => {
      const program = E.gen(function* () {
        const dungeonRunStore = yield* DungeonRunStore;
        const ownRun = yield* createStartedLocalRun();

        const otherRun = yield* dungeonRunStore.importFellowshipLogs({
          dungeonId: MOCK_DUNGEON_ID,
          dungeonLevel: MOCK_DUNGEON_LEVEL,
          endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
          fightId: FIGHT_ID,
          isOwnRun: false,
          observations: [],
          reportCode: REPORT_CODE,
          startedAt: MOCK_DUNGEON_RUN_STARTED_AT,
        });

        yield* dungeonRunStore.deleteHistory({
          dungeonId: MOCK_DUNGEON_ID,
          dungeonLevel: MOCK_DUNGEON_LEVEL,
        });

        const ownLocalRun = yield* dungeonRunStore.getLocal({
          dungeonRunId: ownRun.id,
        });

        const otherFellowshipLogsRun = getSome(
          yield* dungeonRunStore.getFellowshipLogsRun({
            fightId: FIGHT_ID,
            reportCode: REPORT_CODE,
          }),
        );

        expect(ownLocalRun).toEqual(Option.none());
        expect(otherFellowshipLogsRun.dungeonRunId).toBe(otherRun.id);
      }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

      await runTest(program);
    });
  });
});
