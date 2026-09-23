import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schedule from "effect/Schedule";
import { describe, expect, test } from "vitest";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { BackgroundJobs } from "@frt/api/services/background-jobs/background-jobs-service.ts";
import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { LocalLogDungeonRunDAO } from "@frt/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { type DungeonRunId } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";

// `KeyValueStore.layerFileSystem` keeps each key in a file named after it.
const QUEUE_FILE_NAME = encodeURIComponent("queue/background-jobs");

const createUnfinishedRun = E.gen(function* () {
  const dungeonRunRepository = yield* DungeonRunRepository;

  const dungeonRun = yield* dungeonRunRepository.createLocal({
    dungeonId: MOCK_DUNGEON_ID,
    dungeonLevel: MOCK_DUNGEON_LEVEL,
  });

  yield* dungeonRunRepository.startLocal({
    dungeonRunId: dungeonRun.id,
    startedAt: yield* DateTime.now,
  });

  return dungeonRun.id;
});

function getLocalRunStatus(dungeonRunId: DungeonRunId) {
  return LocalLogDungeonRunDAO.use((dao) => {
    return dao.getByDungeonRunId({ dungeonRunId });
  }).pipe(
    E.map((localLogDungeonRun) => {
      return Option.getOrThrow(localLogDungeonRun).status;
    }),
  );
}

describe("BackgroundJobs", () => {
  test("runs a queued job and clears it from the queue file", async () => {
    const { queueFile, status } = await E.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const directory = yield* fileSystem.makeTempDirectoryScoped();
      const backgroundJobsDirectory = path.join(directory, "background-jobs");

      const PersistenceTestLayer = makePersistenceTestLayer(
        path.join(directory, "database.db"),
      );

      const dungeonRunId = yield* createUnfinishedRun.pipe(
        E.provide(PersistenceTestLayer),
      );

      yield* E.sleep("5 millis");

      return yield* E.gen(function* () {
        const backgroundJobs = yield* BackgroundJobs;
        const createdBefore = yield* DateTime.now;

        yield* backgroundJobs.offer({
          _tag: "InterruptUnfinishedDungeonRuns",
          createdBefore,
        });

        // The worker runs it in the background; wait for its result.
        const finalStatus = yield* getLocalRunStatus(dungeonRunId).pipe(
          E.repeat({
            schedule: Schedule.spaced("10 millis"),
            until: (currentStatus) => {
              return currentStatus !== "ACTIVE";
            },
          }),
          E.timeout("2 seconds"),
        );

        const readQueueFile = fileSystem.readFileString(
          path.join(backgroundJobsDirectory, QUEUE_FILE_NAME),
        );

        // The job is removed once it's settled, just after its effects land.
        const finalQueueFile = yield* readQueueFile.pipe(
          E.repeat({
            schedule: Schedule.spaced("10 millis"),
            until: (contents) => {
              return contents.includes('"items":[]');
            },
          }),
          E.timeout("2 seconds"),
        );

        return { queueFile: finalQueueFile, status: finalStatus };
      }).pipe(
        E.provide(
          BackgroundJobs.layerWith({ backgroundJobsDirectory }).pipe(
            Layer.provideMerge(PersistenceTestLayer),
          ),
        ),
      );
    }).pipe(E.scoped, E.provide(NodePlatformLayer), runTest);

    expect(status).toBe("INTERRUPTED");
    expect(JSON.parse(queueFile)).toEqual({ items: [] });
  });
});
