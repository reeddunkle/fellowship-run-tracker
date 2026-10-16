import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as TestClock from "effect/testing/TestClock";
import { describe, expect, test } from "vitest";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { runBackgroundJob } from "@frt/api/tests/common/run-background-job.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { type BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { type FellowshipLogsResponseDAO } from "@frt/db/daos/fellowship-logs-response/fellowship-logs-response-dao.ts";
import { DungeonRunStore } from "@frt/db/stores/dungeon-run/dungeon-run-store.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { type DungeonRunId } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";

const STARTED_AT = DateTime.makeUnsafe("2026-09-05T16:00:00.000Z");

type Persistence =
  | BackgroundJobDAO
  | DungeonRunStore
  | FellowshipLogsResponseDAO;

function runSession<A, Error>(
  databaseFilename: string,
  program: E.Effect<A, Error, Persistence>,
) {
  return program.pipe(E.provide(makePersistenceTestLayer(databaseFilename)));
}

const startLocalRun = E.fnUntraced(function* () {
  const dungeonRunStore = yield* DungeonRunStore;

  const dungeonRun = yield* dungeonRunStore.createLocal({
    dungeonId: MOCK_DUNGEON_ID,
    dungeonLevel: MOCK_DUNGEON_LEVEL,
  });

  yield* dungeonRunStore.startLocal({
    dungeonRunId: dungeonRun.id,
    startedAt: STARTED_AT,
  });

  return [dungeonRun.id];
});

const getLocalRun = E.fnUntraced(function* (dungeonRunId: DungeonRunId) {
  const dungeonRunStore = yield* DungeonRunStore;

  const localRun = yield* dungeonRunStore.getLocal({ dungeonRunId });

  return Option.getOrThrow(localRun);
});

function runJobAfterRestart({
  duringNextSession = E.succeed([]),
  seed,
}: {
  readonly duringNextSession?: E.Effect<
    ReadonlyArray<DungeonRunId>,
    unknown,
    Persistence
  >;
  readonly seed: E.Effect<ReadonlyArray<DungeonRunId>, unknown, Persistence>;
}) {
  return E.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const directory = yield* fileSystem.makeTempDirectoryScoped();
    const databaseFilename = path.join(directory, "database.db");

    const seededIds = yield* runSession(databaseFilename, seed);

    yield* TestClock.adjust("1 second");

    return yield* runSession(
      databaseFilename,
      E.gen(function* () {
        const createdBefore = yield* DateTime.now;
        const nextSessionIds = yield* duringNextSession;

        yield* runBackgroundJob({
          _tag: "InterruptUnfinishedDungeonRuns",
          createdBefore,
        });

        return yield* E.forEach([...seededIds, ...nextSessionIds], getLocalRun);
      }),
    );
  }).pipe(
    E.scoped,
    E.provide(Layer.merge(NodePlatformLayer, TestClock.layer())),
    runTest,
  );
}

describe("InterruptUnfinishedDungeonRuns job", () => {
  test("interrupts an unfinished run from a previous session", async () => {
    const [run] = await runJobAfterRestart({
      seed: startLocalRun(),
    });

    expect(run?.status).toBe("INTERRUPTED");
    expect(run?.dungeonRun.endedAt).not.toBeNull();
  });

  test("leaves a run started in the current session active", async () => {
    const [previousRun, currentRun] = await runJobAfterRestart({
      duringNextSession: startLocalRun(),
      seed: startLocalRun(),
    });

    expect(previousRun?.status).toBe("INTERRUPTED");
    expect(currentRun?.status).toBe("ACTIVE");
    expect(currentRun?.dungeonRun.endedAt).toBeNull();
  });
});
