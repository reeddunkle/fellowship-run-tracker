import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { describe, expect, test } from "vitest";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { pruneLogFiles } from "@frt/api/logging/prune-log-files.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const CLEAN_ENTRY = '{"message":["Run started."],"level":"INFO"}\n';
const ERROR_ENTRY = '{"message":["Failed."],"level":"ERROR"}\n';

type TestLogFile = {
  readonly ageDays: number;
  readonly contents: string;
  readonly name: string;
};

function sessionFileName(index: number) {
  const seconds = String(index % 60).padStart(2, "0");
  const minutes = String(Math.floor(index / 60) % 60).padStart(2, "0");

  return `fellowship-run-tracker-2026-01-01T00-${minutes}-${seconds}.log`;
}

/**
 * Writes `files` into a temp directory with their modified times backdated by
 * `ageDays`, prunes it, and returns the file names left.
 */
function pruneFiles({
  currentFileName,
  files,
}: {
  readonly currentFileName: string;
  readonly files: ReadonlyArray<TestLogFile>;
}) {
  return E.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directory = yield* fileSystem.makeTempDirectoryScoped();
    const now = DateTime.toEpochMillis(yield* DateTime.now);

    yield* E.forEach(
      files,
      (file) => {
        const filePath = path.join(directory, file.name);

        // `utimes` takes numeric times in seconds.
        const modifiedAtSeconds =
          (now - file.ageDays * MILLISECONDS_PER_DAY) / 1000;

        return fileSystem
          .writeFileString(filePath, file.contents)
          .pipe(
            E.andThen(
              fileSystem.utimes(filePath, modifiedAtSeconds, modifiedAtSeconds),
            ),
          );
      },
      { discard: true },
    );

    yield* pruneLogFiles({
      currentLogFilePath: path.join(directory, currentFileName),
      directory,
    });

    const remaining = yield* fileSystem.readDirectory(directory);

    return remaining.toSorted();
  }).pipe(E.scoped, E.provide(NodePlatformLayer), runTest);
}

describe("pruneLogFiles", () => {
  test("deletes clean sessions after 30 days and problem sessions after 90", async () => {
    const remaining = await pruneFiles({
      currentFileName: sessionFileName(0),
      files: [
        { ageDays: 0, contents: CLEAN_ENTRY, name: sessionFileName(0) },
        { ageDays: 10, contents: CLEAN_ENTRY, name: sessionFileName(1) },
        { ageDays: 45, contents: CLEAN_ENTRY, name: sessionFileName(2) },
        { ageDays: 45, contents: ERROR_ENTRY, name: sessionFileName(3) },
        { ageDays: 120, contents: ERROR_ENTRY, name: sessionFileName(4) },
      ],
    });

    expect(remaining).toEqual([
      sessionFileName(0),
      sessionFileName(1),
      sessionFileName(3),
    ]);
  });

  test("also ages out the earlier one-file-per-day logs", async () => {
    const remaining = await pruneFiles({
      currentFileName: sessionFileName(0),
      files: [
        {
          ageDays: 45,
          contents: CLEAN_ENTRY,
          name: "2026-01-01-fellowship-run-tracker.log",
        },
      ],
    });

    expect(remaining).toEqual([]);
  });

  test("never deletes the current session or non-log files", async () => {
    const remaining = await pruneFiles({
      currentFileName: sessionFileName(0),
      files: [
        { ageDays: 365, contents: CLEAN_ENTRY, name: sessionFileName(0) },
        { ageDays: 365, contents: CLEAN_ENTRY, name: "notes.txt" },
      ],
    });

    expect(remaining).toEqual([sessionFileName(0), "notes.txt"]);
  });

  test("keeps at most 200 files, deleting the oldest", async () => {
    const files = Array.from({ length: 205 }, (_, index) => {
      return {
        ageDays: index / 100,
        contents: CLEAN_ENTRY,
        name: sessionFileName(index),
      };
    });

    const remaining = await pruneFiles({
      currentFileName: sessionFileName(0),
      files,
    });

    // 199 most recent previous sessions plus the current one.
    expect(remaining).toHaveLength(200);
    expect(remaining).toContain(sessionFileName(0));
    expect(remaining).not.toContain(sessionFileName(204));
    expect(remaining).toContain(sessionFileName(199));
    expect(remaining).not.toContain(sessionFileName(200));
  });
});
