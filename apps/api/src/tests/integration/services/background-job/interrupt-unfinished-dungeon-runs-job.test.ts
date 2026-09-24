import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as TestClock from "effect/testing/TestClock";
import { describe, expect, test } from "vitest";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { runBackgroundJob } from "@frt/api/services/background-job/run-background-job.ts";
import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { type BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { DungeonRunDAO } from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { type FellowshipLogsResponseDAO } from "@frt/db/daos/fellowship-logs-response/fellowship-logs-response-dao.ts";
import { LocalLogDungeonRunDAO } from "@frt/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { type DungeonRunId } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";

const UnusedFellowshipLogsDungeonRunImporter = Layer.succeed(
  FellowshipLogsDungeonRunImporter,
  {
    importReport: () => {
      return E.die("unexpected call: importReport");
    },
  },
);

const STARTED_AT = DateTime.makeUnsafe("2026-09-05T16:00:00.000Z");
const EARLIER_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:05:00.000Z");
const LATEST_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:12:00.000Z");
const COMPLETED_AT = DateTime.makeUnsafe("2026-09-05T16:30:00.000Z");

type Persistence =
  | BackgroundJobDAO
  | DungeonRunDAO
  | DungeonRunObservationDAO
  | DungeonRunRepository
  | FellowshipLogsResponseDAO
  | LocalLogDungeonRunDAO;

function runSession<A, Error>(
  databaseFilename: string,
  program: E.Effect<A, Error, Persistence>,
) {
  return program.pipe(E.provide(makePersistenceTestLayer(databaseFilename)));
}

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

        yield* runBackgroundJob(
          {
            _tag: "InterruptUnfinishedDungeonRuns",
            createdBefore,
          },
          { reportProgress: () => E.void },
        ).pipe(
          E.provide(
            Layer.merge(
              UnusedFellowshipLogsDungeonRunImporter,
              NodePlatformLayer,
            ),
          ),
        );

        return yield* E.forEach([...seededIds, ...nextSessionIds], getLocalRun);
      }),
    );
  }).pipe(
    E.scoped,
    E.provide(Layer.merge(NodePlatformLayer, TestClock.layer())),
    runTest,
  );
}

function toEpochMillis(dateTime: DateTime.Utc | null | undefined) {
  return dateTime === null || dateTime === undefined
    ? null
    : DateTime.toEpochMillis(dateTime);
}

function single(dungeonRunId: E.Effect<DungeonRunId, unknown, Persistence>) {
  return dungeonRunId.pipe(
    E.map((id) => {
      return [id];
    }),
  );
}

describe("InterruptUnfinishedDungeonRuns job", () => {
  test("interrupts an unfinished run at its latest observation", async () => {
    const [run] = await runJobAfterRestart({
      seed: single(startLocalRun([LATEST_OBSERVED_AT, EARLIER_OBSERVED_AT])),
    });

    expect(run?.status).toBe("INTERRUPTED");
    expect(toEpochMillis(run?.endedAt)).toBe(
      DateTime.toEpochMillis(LATEST_OBSERVED_AT),
    );
  });

  test("interrupts an unfinished run without observations when it started", async () => {
    const [run] = await runJobAfterRestart({
      seed: single(startLocalRun([])),
    });

    expect(run?.status).toBe("INTERRUPTED");
    expect(toEpochMillis(run?.endedAt)).toBe(
      DateTime.toEpochMillis(STARTED_AT),
    );
  });

  test("leaves finished runs unchanged", async () => {
    const [run] = await runJobAfterRestart({
      seed: E.gen(function* () {
        const dungeonRunRepository = yield* DungeonRunRepository;
        const dungeonRunId = yield* startLocalRun([EARLIER_OBSERVED_AT]);

        yield* dungeonRunRepository.completeLocal({
          dungeonRunId,
          endedAt: COMPLETED_AT,
        });

        return [dungeonRunId];
      }),
    });

    expect(run?.status).toBe("COMPLETED");
    expect(toEpochMillis(run?.endedAt)).toBe(
      DateTime.toEpochMillis(COMPLETED_AT),
    );
  });

  test("leaves a run started in the current session active", async () => {
    const [previousRun, currentRun] = await runJobAfterRestart({
      duringNextSession: single(startLocalRun([])),
      seed: single(startLocalRun([])),
    });

    expect(previousRun?.status).toBe("INTERRUPTED");
    expect(currentRun?.status).toBe("ACTIVE");
    expect(currentRun?.endedAt).toBeNull();
  });
});
