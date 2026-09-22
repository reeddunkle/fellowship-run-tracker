import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import { describe, expect, test } from "vitest";

import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { makeFellowshipTrackerIntegrationTestHarness } from "@frt/api/tests/common/harnesses/fellowship-tracker-integration-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { DungeonRunDAO } from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { LocalLogDungeonRunDAO } from "@frt/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { type DungeonRunId } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";

const STARTED_AT = DateTime.makeUnsafe("2026-09-05T16:00:00.000Z");
const EARLIER_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:05:00.000Z");
const LATEST_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:12:00.000Z");
const COMPLETED_AT = DateTime.makeUnsafe("2026-09-05T16:30:00.000Z");

/**
 * Runs `program` in one app session: the tracker and persistence built on
 * `databaseFilename`, torn down when the session ends. Constructing the
 * tracker is part of the app starting up.
 */
function runSession<A, Error, Requirements>(
  databaseFilename: string,
  program: E.Effect<A, Error, Requirements>,
) {
  return E.gen(function* () {
    const { layer } = yield* makeFellowshipTrackerIntegrationTestHarness({
      databaseFilename,
    });

    return yield* E.gen(function* () {
      yield* FellowshipTracker;

      return yield* program;
    }).pipe(E.provide(layer));
  }).pipe(E.scoped);
}

/**
 * Starts a local run, with an observation at each of `observedAts`, and
 * leaves it unfinished: what a session leaves behind when it ends mid-run (a
 * crash, a force quit, or a failed write when stopping).
 */
function startLocalRun(observedAts: ReadonlyArray<DateTime.Utc>) {
  return E.gen(function* () {
    const dungeonRunRepository = yield* DungeonRunRepository;
    const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;

    const dungeonRun = yield* dungeonRunRepository.createLocal({
      dungeonId: MOCK_DUNGEON_ID,
      dungeonLevel: MOCK_DUNGEON_LEVEL,
    });

    yield* dungeonRunRepository.startLocal({
      dungeonRunId: dungeonRun.id,
      startedAt: STARTED_AT,
    });

    yield* E.forEach(
      observedAts,
      (observedAt, index) => {
        return dungeonRunObservationDAO.observe({
          dungeonRunId: dungeonRun.id,
          observedAt,
          targetId: String(index + 1),
          type: "UNIT_DEATH",
        });
      },
      { discard: true },
    );

    return dungeonRun.id;
  });
}

function getLocalRun(dungeonRunId: DungeonRunId) {
  return E.gen(function* () {
    const dungeonRun = yield* DungeonRunDAO.use((dao) => {
      return dao.getById({ id: dungeonRunId });
    });

    const localLogDungeonRun = yield* LocalLogDungeonRunDAO.use((dao) => {
      return dao.getByDungeonRunId({ dungeonRunId });
    });

    return {
      endedAt: Option.getOrThrow(dungeonRun).endedAt,
      status: Option.getOrThrow(localLogDungeonRun).status,
    };
  });
}

/**
 * Seeds runs with `seed` in one session, then reads each back after the app
 * starts again on the same database.
 */
function restartAfter(
  seed: E.Effect<
    ReadonlyArray<DungeonRunId>,
    unknown,
    DungeonRunObservationDAO | DungeonRunRepository
  >,
) {
  return E.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const directory = yield* fileSystem.makeTempDirectoryScoped();
    const databaseFilename = path.join(directory, "database.db");

    const dungeonRunIds = yield* runSession(databaseFilename, seed);

    return yield* runSession(
      databaseFilename,
      E.forEach(dungeonRunIds, getLocalRun),
    );
  }).pipe(E.scoped, E.provide(NodePlatformLayer), runTest);
}

function toEpochMillis(dateTime: DateTime.Utc | null) {
  return dateTime === null ? null : DateTime.toEpochMillis(dateTime);
}

describe("FellowshipTracker startup recovery", () => {
  test("interrupts an unfinished run at its latest observation", async () => {
    const [run] = await restartAfter(
      startLocalRun([LATEST_OBSERVED_AT, EARLIER_OBSERVED_AT]).pipe(
        E.map((dungeonRunId) => {
          return [dungeonRunId];
        }),
      ),
    );

    expect(run?.status).toBe("INTERRUPTED");
    expect(toEpochMillis(run?.endedAt ?? null)).toBe(
      DateTime.toEpochMillis(LATEST_OBSERVED_AT),
    );
  });

  test("interrupts an unfinished run without observations when it started", async () => {
    const [run] = await restartAfter(
      startLocalRun([]).pipe(
        E.map((dungeonRunId) => {
          return [dungeonRunId];
        }),
      ),
    );

    expect(run?.status).toBe("INTERRUPTED");
    expect(toEpochMillis(run?.endedAt ?? null)).toBe(
      DateTime.toEpochMillis(STARTED_AT),
    );
  });

  test("leaves finished runs unchanged", async () => {
    const [run] = await restartAfter(
      E.gen(function* () {
        const dungeonRunRepository = yield* DungeonRunRepository;
        const dungeonRunId = yield* startLocalRun([EARLIER_OBSERVED_AT]);

        yield* dungeonRunRepository.completeLocal({
          dungeonRunId,
          endedAt: COMPLETED_AT,
        });

        return [dungeonRunId];
      }),
    );

    expect(run?.status).toBe("COMPLETED");
    expect(toEpochMillis(run?.endedAt ?? null)).toBe(
      DateTime.toEpochMillis(COMPLETED_AT),
    );
  });
});
