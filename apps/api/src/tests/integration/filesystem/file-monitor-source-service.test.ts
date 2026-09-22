import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FileMonitorSource } from "@frt/api/services/filesystem/file-monitor-source-service.ts";
import {
  FileMonitorSourceTestLive,
  makeFileMonitorSourceFailureTestLive,
  makeFileMonitorSourceTestHarness,
} from "@frt/api/tests/common/harnesses/file-monitor-source-test-harness.ts";
import { makeStreamTestHarness } from "@frt/api/tests/common/harnesses/stream-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const matchesTextFile = (fileName: string): boolean => {
  return fileName.endsWith(".txt");
};

describe("FileMonitorSource", () => {
  describe("findLatestFile", () => {
    test("finds a matching file", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorSourceTestHarness();

          const filePath = harness.getFilePath("fellowship.txt");

          yield* harness.writeFile("fellowship.txt", "first line\n");

          const file = yield* harness.fileMonitorSource.findLatestFile({
            directoryPath: harness.directoryPath,
            matches: matchesTextFile,
          });

          expect(file.filePath).toBe(filePath);
          expect(file.size).toBe(FileSystem.Size(11));
        }),
      ).pipe(E.provide(FileMonitorSourceTestLive));

      await runTest(program);
    });

    test("ignores files that do not match", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorSourceTestHarness();

          yield* harness.writeFile("fellowship.log", "log contents\n");

          const result = yield* harness.fileMonitorSource
            .findLatestFile({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
            })
            .pipe(E.result);

          expect(Result.isFailure(result)).toBe(true);

          if (Result.isFailure(result)) {
            expect(result.failure._tag).toBe("FileNotFoundError");
          }
        }),
      ).pipe(E.provide(FileMonitorSourceTestLive));

      await runTest(program);
    });

    test("ignores matching directories", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorSourceTestHarness();

          yield* harness.makeDirectory("not-a-file.txt");

          const result = yield* harness.fileMonitorSource
            .findLatestFile({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
            })
            .pipe(E.result);

          expect(Result.isFailure(result)).toBe(true);

          if (Result.isFailure(result)) {
            expect(result.failure._tag).toBe("FileNotFoundError");
          }
        }),
      ).pipe(E.provide(FileMonitorSourceTestLive));

      await runTest(program);
    });
  });

  describe("streamLatestFile", () => {
    test("emits None initially and Some when a matching file appears", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorSourceTestHarness();

          const filePath = harness.getFilePath("fellowship.txt");

          const latestFiles = yield* makeStreamTestHarness(
            harness.fileMonitorSource.streamLatestFile({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
            }),
          );

          const initialLatestFile = yield* latestFiles.take;

          expect(Option.isNone(initialLatestFile)).toBe(true);

          yield* harness.writeFile("fellowship.txt", "first line\n");

          const updatedLatestFile = yield* latestFiles.take;

          expect(Option.isSome(updatedLatestFile)).toBe(true);

          if (Option.isSome(updatedLatestFile)) {
            expect(updatedLatestFile.value.filePath).toBe(filePath);
          }
        }),
      ).pipe(E.provide(FileMonitorSourceTestLive));

      await runTest(program);
    });

    test("emits the current matching file initially", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorSourceTestHarness();

          const filePath = harness.getFilePath("fellowship.txt");

          yield* harness.writeFile("fellowship.txt", "first line\n");

          const latestFiles = yield* makeStreamTestHarness(
            harness.fileMonitorSource.streamLatestFile({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
            }),
          );

          const initialLatestFile = yield* latestFiles.take;

          expect(Option.isSome(initialLatestFile)).toBe(true);

          if (Option.isSome(initialLatestFile)) {
            expect(initialLatestFile.value.filePath).toBe(filePath);
          }
        }),
      ).pipe(E.provide(FileMonitorSourceTestLive));

      await runTest(program);
    });

    test("emits another value when the current file is updated", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorSourceTestHarness();

          yield* harness.writeFile("fellowship.txt", "first line\n");

          const latestFiles = yield* makeStreamTestHarness(
            harness.fileMonitorSource.streamLatestFile({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
            }),
          );

          const initialLatestFile = yield* latestFiles.take;

          yield* harness.appendFile("fellowship.txt", "second line\n");

          const updatedLatestFile = yield* latestFiles.take;

          expect(Option.isSome(initialLatestFile)).toBe(true);
          expect(Option.isSome(updatedLatestFile)).toBe(true);

          if (
            Option.isSome(initialLatestFile) &&
            Option.isSome(updatedLatestFile)
          ) {
            expect(updatedLatestFile.value.filePath).toBe(
              initialLatestFile.value.filePath,
            );

            expect(updatedLatestFile.value.size).toBeGreaterThan(
              initialLatestFile.value.size,
            );
          }
        }),
      ).pipe(E.provide(FileMonitorSourceTestLive));

      await runTest(program);
    });

    test("emits None when the current matching file is removed", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorSourceTestHarness();

          yield* harness.writeFile("fellowship.txt", "first line\n");

          const latestFiles = yield* makeStreamTestHarness(
            harness.fileMonitorSource.streamLatestFile({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
            }),
          );

          const initialLatestFile = yield* latestFiles.take;

          expect(Option.isSome(initialLatestFile)).toBe(true);

          yield* harness.removeFile("fellowship.txt");

          const removedLatestFile = yield* latestFiles.take;

          expect(Option.isNone(removedLatestFile)).toBe(true);
        }),
      ).pipe(E.provide(FileMonitorSourceTestLive));

      await runTest(program);
    });

    test("fails when the filesystem watcher fails", async () => {
      const watchError = PlatformError.systemError({
        _tag: "Unknown",
        description: "Test watcher failure.",
        method: "watch",
        module: "FileSystem",
      });

      const program = E.scoped(
        E.gen(function* () {
          const fileMonitorSource = yield* FileMonitorSource;
          const fileSystem = yield* FileSystem.FileSystem;

          const directoryPath = yield* fileSystem.makeTempDirectoryScoped({
            prefix: "file-monitor-source-",
          });

          const result = yield* fileMonitorSource
            .streamLatestFile({
              directoryPath,
              matches: matchesTextFile,
            })
            .pipe(Stream.runCollect, E.result);

          expect(Result.isFailure(result)).toBe(true);

          if (Result.isFailure(result)) {
            expect(result.failure).toBe(watchError);
          }
        }),
      ).pipe(E.provide(makeFileMonitorSourceFailureTestLive(watchError)));

      await runTest(program);
    });
  });

  describe("streamStatus", () => {
    test("transitions from waiting for a file to monitoring", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorSourceTestHarness();

          const filePath = harness.getFilePath("fellowship.txt");

          const statuses = yield* makeStreamTestHarness(
            harness.fileMonitorSource.streamStatus({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
            }),
          );

          const waitingStatus = yield* statuses.take;

          expect(waitingStatus).toEqual({
            _tag: "WAITING_FOR_FILE",
            directoryPath: harness.directoryPath,
          });

          yield* harness.writeFile("fellowship.txt", "first line\n");

          const monitoringStatus = yield* statuses.take;

          expect(monitoringStatus).toEqual({
            _tag: "MONITORING",
            directoryPath: harness.directoryPath,
            filePath,
          });
        }),
      ).pipe(E.provide(FileMonitorSourceTestLive));

      await runTest(program);
    });

    test("does not emit another status when the monitored file is only updated", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorSourceTestHarness();

          const filePath = harness.getFilePath("fellowship.txt");

          yield* harness.writeFile("fellowship.txt", "first line\n");

          const statuses = yield* makeStreamTestHarness(
            harness.fileMonitorSource.streamStatus({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
            }),
          );

          const latestFiles = yield* makeStreamTestHarness(
            harness.fileMonitorSource.streamLatestFile({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
            }),
          );

          const initialStatus = yield* statuses.take;
          const initialLatestFile = yield* latestFiles.take;

          expect(initialStatus).toEqual({
            _tag: "MONITORING",
            directoryPath: harness.directoryPath,
            filePath,
          });

          expect(Option.isSome(initialLatestFile)).toBe(true);

          yield* harness.appendFile("fellowship.txt", "second line\n");

          const updatedLatestFile = yield* latestFiles.take;

          expect(Option.isSome(updatedLatestFile)).toBe(true);

          yield* harness.removeFile("fellowship.txt");

          const nextStatus = yield* statuses.take;

          expect(nextStatus).toEqual({
            _tag: "WAITING_FOR_FILE",
            directoryPath: harness.directoryPath,
          });
        }),
      ).pipe(E.provide(FileMonitorSourceTestLive));

      await runTest(program);
    });
  });
});
