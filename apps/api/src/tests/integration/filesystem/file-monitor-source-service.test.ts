import * as ByteSize from "effect/ByteSize";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FileMonitorSource } from "@frt/api/services/filesystem/file-monitor-source-service.ts";
import {
  FileMonitorSourceTestLive,
  makeFileMonitorSourceFailureTestLive,
  makeFileMonitorSourceTestHarness,
  makeWatchCountingFileMonitorSourceTestLive,
} from "@frt/api/tests/common/harnesses/file-monitor-source-test-harness.ts";
import { makeStreamTestHarness } from "@frt/api/tests/common/harnesses/stream-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const matchesTextFile = (fileName: string): boolean => {
  return fileName.endsWith(".txt");
};

const NO_FURTHER_SCAN_WINDOW = "50 millis";

function waitFor(deferred: Deferred.Deferred<void>) {
  return deferred.pipe(Deferred.await, Stream.fromEffect, Stream.drain);
}

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
          expect(file.size).toBe(ByteSize.bytes(11));
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

  describe("directory watcher sharing", () => {
    test("shares one watcher between concurrent streams of the same directory", async () => {
      const program = E.gen(function* () {
        const watchCounting =
          yield* makeWatchCountingFileMonitorSourceTestLive();

        yield* E.scoped(
          E.gen(function* () {
            const harness = yield* makeFileMonitorSourceTestHarness();

            const options = {
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
            };

            const firstLatestFiles = yield* makeStreamTestHarness(
              harness.fileMonitorSource.streamLatestFile(options),
            );

            const secondLatestFiles = yield* makeStreamTestHarness(
              harness.fileMonitorSource.streamStatus(options),
            );

            yield* firstLatestFiles.take;
            yield* secondLatestFiles.take;

            yield* harness.writeFile("fellowship.txt", "first line\n");

            const firstUpdate = yield* firstLatestFiles.take;
            const secondUpdate = yield* secondLatestFiles.take;

            expect(Option.isSome(firstUpdate)).toBe(true);
            expect(secondUpdate._tag).toBe("MONITORING");
            expect(yield* Ref.get(watchCounting.openedWatchCount)).toBe(1);
          }),
        ).pipe(E.provide(watchCounting.layer));
      });

      await runTest(program);
    });

    test("closes the watcher when the last stream ends and reopens it on demand", async () => {
      const program = E.gen(function* () {
        const watchCounting =
          yield* makeWatchCountingFileMonitorSourceTestLive();

        yield* E.scoped(
          E.gen(function* () {
            const harness = yield* makeFileMonitorSourceTestHarness();

            const options = {
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
            };

            yield* E.scoped(
              E.gen(function* () {
                const latestFiles = yield* makeStreamTestHarness(
                  harness.fileMonitorSource.streamLatestFile(options),
                );

                yield* latestFiles.take;
              }),
            );

            expect(yield* Ref.get(watchCounting.closedWatchCount)).toBe(1);

            const latestFiles = yield* makeStreamTestHarness(
              harness.fileMonitorSource.streamLatestFile(options),
            );

            yield* latestFiles.take;

            expect(yield* Ref.get(watchCounting.openedWatchCount)).toBe(2);
          }),
        ).pipe(E.provide(watchCounting.layer));
      });

      await runTest(program);
    });

    describe("when the watcher stops", () => {
      function failStreamsThenRecover(
        firstWatch: Stream.Stream<
          FileSystem.WatchEvent,
          PlatformError.PlatformError
        >,
      ) {
        return E.gen(function* () {
          const watchCounting =
            yield* makeWatchCountingFileMonitorSourceTestLive({
              firstWatch,
            });

          return yield* E.scoped(
            E.gen(function* () {
              const harness = yield* makeFileMonitorSourceTestHarness();

              const options = {
                directoryPath: harness.directoryPath,
                matches: matchesTextFile,
              };

              const [latestFileError, statusError] = yield* E.all(
                [
                  harness.fileMonitorSource
                    .streamLatestFile(options)
                    .pipe(Stream.runDrain, E.flip),
                  harness.fileMonitorSource
                    .streamStatus(options)
                    .pipe(Stream.runDrain, E.flip),
                ],
                {
                  concurrency: "unbounded",
                },
              );

              const recoveredLatestFiles = yield* makeStreamTestHarness(
                harness.fileMonitorSource
                  .streamLatestFile(options)
                  .pipe(Stream.retry(Schedule.recurs(3))),
              );

              yield* recoveredLatestFiles.take;

              return {
                latestFileError,
                openedWatchCount: yield* Ref.get(
                  watchCounting.openedWatchCount,
                ),
                statusError,
              };
            }),
          ).pipe(E.provide(watchCounting.layer), E.timeout("2 seconds"));
        });
      }

      test("fails every stream when the watcher fails and recovers with a fresh watcher", async () => {
        const watchError = PlatformError.systemError({
          _tag: "Unknown",
          description: "Test watcher failure.",
          method: "watch",
          module: "FileSystem",
        });

        const result = await Stream.fail(watchError).pipe(
          failStreamsThenRecover,
          runTest,
        );

        expect(result.latestFileError).toBe(watchError);
        expect(result.statusError).toBe(watchError);
        expect(result.openedWatchCount).toBe(2);
      });

      test("fails every stream when the watcher closes and recovers with a fresh watcher", async () => {
        const result = await Stream.empty.pipe(failStreamsThenRecover, runTest);

        expect(result.latestFileError.message).toContain(
          "The directory watcher closed unexpectedly.",
        );
        expect(result.statusError.message).toContain(
          "The directory watcher closed unexpectedly.",
        );
        expect(result.openedWatchCount).toBe(2);
      });
    });

    test("coalesces watch events that arrive while a directory scan is running", async () => {
      const program = E.gen(function* () {
        const emitFirstEvent = yield* Deferred.make<void>();
        const emitEventBurst = yield* Deferred.make<void>();
        const eventBurstPublished = yield* Deferred.make<void>();
        const rescanStarted = yield* Deferred.make<void>();
        const releaseRescan = yield* Deferred.make<void>();

        const updateEvent: FileSystem.WatchEvent = {
          _tag: "Update",
          path: "fellowship.txt",
        };

        const watchEvents = waitFor(emitFirstEvent).pipe(
          Stream.concat(Stream.make(updateEvent)),
          Stream.concat(waitFor(emitEventBurst)),
          Stream.concat(
            Stream.fromIterable(
              Array.from({ length: 50 }, () => {
                return updateEvent;
              }),
            ),
          ),
          Stream.concat(
            Stream.fromEffect(
              Deferred.succeed(eventBurstPublished, undefined),
            ).pipe(Stream.drain),
          ),
          Stream.concat(Stream.never),
        );

        const watchCounting = yield* makeWatchCountingFileMonitorSourceTestLive(
          {
            beforeReadDirectory: (readNumber) => {
              return readNumber === 2
                ? Deferred.succeed(rescanStarted, undefined).pipe(
                    E.andThen(Deferred.await(releaseRescan)),
                  )
                : E.void;
            },
            firstWatch: watchEvents,
          },
        );

        yield* E.scoped(
          E.gen(function* () {
            const harness = yield* makeFileMonitorSourceTestHarness();

            const latestFiles = yield* makeStreamTestHarness(
              harness.fileMonitorSource.streamLatestFile({
                directoryPath: harness.directoryPath,
                matches: matchesTextFile,
              }),
            );

            yield* latestFiles.take;

            yield* Deferred.succeed(emitFirstEvent, undefined);
            yield* Deferred.await(rescanStarted);

            yield* Deferred.succeed(emitEventBurst, undefined);
            yield* Deferred.await(eventBurstPublished);

            yield* Deferred.succeed(releaseRescan, undefined);

            yield* latestFiles.take;
            yield* latestFiles.take;

            const extraScan = yield* latestFiles.take.pipe(
              E.timeoutOption(NO_FURTHER_SCAN_WINDOW),
            );

            expect(Option.isNone(extraScan)).toBe(true);
            expect(yield* Ref.get(watchCounting.readDirectoryCount)).toBe(3);
          }),
        ).pipe(E.provide(watchCounting.layer));
      });

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
