import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import {
  FileMonitorTestDependenciesLive,
  makeFileMonitorTestHarness,
} from "@/tests/common/harnesses/file-monitor-test-harness.ts";
import { makeStreamTestHarness } from "@/tests/common/harnesses/stream-test-harness.ts";
import { runTest } from "@/tests/common/run-test.ts";

const matchesTextFile = (fileName: string): boolean => {
  return fileName.toLowerCase().endsWith(".txt");
};

describe("FileMonitor", () => {
  describe("findLatestFile", () => {
    test("delegates latest file discovery to FileMonitorSource", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          const filePath = harness.getFilePath("fellowship.txt");

          yield* harness.writeFile("fellowship.txt", "first line\n");
          yield* harness.emitFile("fellowship.txt");

          const file = yield* harness.fileMonitor.findLatestFile({
            directoryPath: harness.directoryPath,
            matches: matchesTextFile,
          });

          expect(file.filePath).toBe(filePath);
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });
  });

  describe("readLines", () => {
    test("reads all non-empty lines from a file", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          yield* harness.writeFile(
            "fellowship.txt",
            "first line\n\nsecond line\nthird line\n",
          );

          const lines = yield* harness.fileMonitor.readLines({
            filePath: harness.getFilePath("fellowship.txt"),
          });

          expect(lines).toEqual(["first line", "second line", "third line"]);
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });
  });

  describe("streamLines", () => {
    test("streams all non-empty lines from a file", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          yield* harness.writeFile(
            "fellowship.txt",
            "first line\n\nsecond line\nthird line\n",
          );

          const lines = yield* harness.fileMonitor
            .streamLines({
              filePath: harness.getFilePath("fellowship.txt"),
            })
            .pipe(Stream.runCollect);

          expect(lines).toEqual(["first line", "second line", "third line"]);
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });
  });

  describe("streamLatestFileLines", () => {
    test('with startFrom "end" emits only lines appended after monitoring starts', async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          yield* harness.writeFile(
            "fellowship.txt",
            "existing first line\nexisting second line\n",
          );

          const lines = yield* makeStreamTestHarness(
            harness.fileMonitor.streamLatestFileLines({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
              startFrom: "end",
            }),
          );

          yield* harness.awaitSourceRequest;
          yield* harness.emitFile("fellowship.txt");

          /*
           * The next request means the initial snapshot has been processed
           * and the byte offset has been established at the end of the file.
           */
          yield* harness.awaitSourceRequest;

          yield* harness.appendFile(
            "fellowship.txt",
            "appended first line\nappended second line\n",
          );

          yield* harness.emitFile("fellowship.txt");

          const firstLine = yield* lines.take;
          const secondLine = yield* lines.take;

          expect([firstLine, secondLine]).toEqual([
            "appended first line",
            "appended second line",
          ]);
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });

    test('with startFrom "start" reads the initial file immediately from the beginning', async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          yield* harness.writeFile(
            "fellowship.txt",
            "first line\nsecond line\n",
          );

          const lines = yield* makeStreamTestHarness(
            harness.fileMonitor.streamLatestFileLines({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
              startFrom: "start",
            }),
          );

          yield* harness.awaitSourceRequest;
          yield* harness.emitFile("fellowship.txt");

          /*
           * The initial file must be read as part of processing its initial
           * snapshot. No second source notification should be necessary.
           */
          const firstLine = yield* lines.take;
          const secondLine = yield* lines.take;

          expect([firstLine, secondLine]).toEqual([
            "first line",
            "second line",
          ]);

          yield* harness.awaitSourceRequest;

          yield* harness.appendFile("fellowship.txt", "third line\n");
          yield* harness.emitFile("fellowship.txt");

          const thirdLine = yield* lines.take;

          expect(thirdLine).toBe("third line");
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });

    test("reads every line across multiple batches of appended lines", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          yield* harness.writeFile("fellowship.txt", "");

          const lines = yield* makeStreamTestHarness(
            harness.fileMonitor.streamLatestFileLines({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
              startFrom: "end",
            }),
          );

          yield* harness.awaitSourceRequest;
          yield* harness.emitFile("fellowship.txt");

          yield* harness.awaitSourceRequest;

          yield* harness.appendFile(
            "fellowship.txt",
            "batch 1 line 1\nbatch 1 line 2\nbatch 1 line 3\n",
          );
          yield* harness.emitFile("fellowship.txt");

          expect(yield* lines.take).toBe("batch 1 line 1");
          expect(yield* lines.take).toBe("batch 1 line 2");
          expect(yield* lines.take).toBe("batch 1 line 3");

          yield* harness.awaitSourceRequest;

          yield* harness.appendFile(
            "fellowship.txt",
            "batch 2 line 1\nbatch 2 line 2\nbatch 2 line 3\nbatch 2 line 4\n",
          );
          yield* harness.emitFile("fellowship.txt");

          expect(yield* lines.take).toBe("batch 2 line 1");
          expect(yield* lines.take).toBe("batch 2 line 2");
          expect(yield* lines.take).toBe("batch 2 line 3");
          expect(yield* lines.take).toBe("batch 2 line 4");

          yield* harness.awaitSourceRequest;

          yield* harness.appendFile(
            "fellowship.txt",
            "batch 3 line 1\nbatch 3 line 2\n",
          );
          yield* harness.emitFile("fellowship.txt");

          expect(yield* lines.take).toBe("batch 3 line 1");
          expect(yield* lines.take).toBe("batch 3 line 2");
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });

    test("reads all appended lines when multiple source snapshots are queued", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          yield* harness.writeFile("fellowship.txt", "");

          const lines = yield* makeStreamTestHarness(
            harness.fileMonitor.streamLatestFileLines({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
              startFrom: "end",
            }),
          );

          yield* harness.awaitSourceRequest;
          yield* harness.emitFile("fellowship.txt");

          yield* harness.awaitSourceRequest;

          yield* harness.appendFile(
            "fellowship.txt",
            "batch 1 line 1\nbatch 1 line 2\n",
          );

          const firstSnapshot = yield* harness.getFileData("fellowship.txt");

          yield* harness.appendFile(
            "fellowship.txt",
            "batch 2 line 1\nbatch 2 line 2\n",
          );

          const secondSnapshot = yield* harness.getFileData("fellowship.txt");

          /*
           * Queue both filesystem snapshots before FileMonitor gets another
           * opportunity to request one.
           */
          yield* harness.emitSourceValue(Option.some(firstSnapshot));
          yield* harness.emitSourceValue(Option.some(secondSnapshot));

          const firstLine = yield* lines.take;
          const secondLine = yield* lines.take;
          const thirdLine = yield* lines.take;
          const fourthLine = yield* lines.take;

          expect([firstLine, secondLine, thirdLine, fourthLine]).toEqual([
            "batch 1 line 1",
            "batch 1 line 2",
            "batch 2 line 1",
            "batch 2 line 2",
          ]);
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });

    test("waits when no matching file exists and starts monitoring when one appears", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          const lines = yield* makeStreamTestHarness(
            harness.fileMonitor.streamLatestFileLines({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
              startFrom: "end",
            }),
          );

          yield* harness.awaitSourceRequest;
          yield* harness.emitNoFile;

          /*
           * The None value has been processed and FileMonitor is waiting for
           * another source snapshot.
           */
          yield* harness.awaitSourceRequest;

          yield* harness.writeFile("fellowship.txt", "existing line\n");
          yield* harness.emitFile("fellowship.txt");

          /*
           * The newly discovered file has been processed and its initial
           * byte offset has been established at the end.
           */
          yield* harness.awaitSourceRequest;

          yield* harness.appendFile("fellowship.txt", "appended line\n");
          yield* harness.emitFile("fellowship.txt");

          const line = yield* lines.take;

          expect(line).toBe("appended line");
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });

    test("does not emit lines when a source snapshot contains no new bytes", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          yield* harness.writeFile("fellowship.txt", "existing line\n");

          const lines = yield* makeStreamTestHarness(
            harness.fileMonitor.streamLatestFileLines({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
              startFrom: "end",
            }),
          );

          yield* harness.awaitSourceRequest;
          yield* harness.emitFile("fellowship.txt");

          // The initial snapshot has established the current byte offset.
          yield* harness.awaitSourceRequest;

          /*
           * Emit another snapshot without changing the file. FileMonitor
           * should update its metadata but produce no lines.
           */
          yield* harness.emitFile("fellowship.txt");

          /*
           * Reaching the next request proves the unchanged snapshot was
           * processed without blocking or corrupting the read state.
           */
          yield* harness.awaitSourceRequest;

          yield* harness.appendFile("fellowship.txt", "appended line\n");
          yield* harness.emitFile("fellowship.txt");

          const line = yield* lines.take;

          expect(line).toBe("appended line");
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });

    test("handles repeated identical snapshots after multiple writes", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          yield* harness.writeFile("fellowship.txt", "");

          const lines = yield* makeStreamTestHarness(
            harness.fileMonitor.streamLatestFileLines({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
              startFrom: "end",
            }),
          );

          yield* harness.awaitSourceRequest;
          yield* harness.emitFile("fellowship.txt");

          yield* harness.awaitSourceRequest;

          yield* harness.appendFile(
            "fellowship.txt",
            "batch 1 line 1\nbatch 1 line 2\n",
          );

          yield* harness.appendFile(
            "fellowship.txt",
            "batch 2 line 1\nbatch 2 line 2\n",
          );

          const finalSnapshot = yield* harness.getFileData("fellowship.txt");

          /*
           * Model multiple watch events that are both resolved after the writes
           * have completed, so both observe the same final file metadata.
           */
          yield* harness.emitSourceValue(Option.some(finalSnapshot));
          yield* harness.emitSourceValue(Option.some(finalSnapshot));

          expect(yield* lines.take).toBe("batch 1 line 1");
          expect(yield* lines.take).toBe("batch 1 line 2");
          expect(yield* lines.take).toBe("batch 2 line 1");
          expect(yield* lines.take).toBe("batch 2 line 2");

          /*
           * FileMonitor requests and processes the duplicate snapshot.
           */
          yield* harness.awaitSourceRequest;

          /*
           * Reaching the following request proves the duplicate snapshot completed
           * without emitting additional lines.
           */
          yield* harness.awaitSourceRequest;
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });

    test("emits only newly appended complete lines", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          yield* harness.writeFile("fellowship.txt", "");

          const lines = yield* makeStreamTestHarness(
            harness.fileMonitor.streamLatestFileLines({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
              startFrom: "end",
            }),
          );

          yield* harness.awaitSourceRequest;
          yield* harness.emitFile("fellowship.txt");

          yield* harness.awaitSourceRequest;

          yield* harness.appendFile("fellowship.txt", "first line\npartial");

          yield* harness.emitFile("fellowship.txt");

          const firstLine = yield* lines.take;

          expect(firstLine).toBe("first line");

          /*
           * FileMonitor has processed the first update and retained
           * "partial" as its incomplete line.
           */
          yield* harness.awaitSourceRequest;

          yield* harness.appendFile("fellowship.txt", " line\nsecond line\n");

          yield* harness.emitFile("fellowship.txt");

          const partialLine = yield* lines.take;
          const secondLine = yield* lines.take;

          expect([firstLine, partialLine, secondLine]).toEqual([
            "first line",
            "partial line",
            "second line",
          ]);
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });

    test("switches to a newer matching file", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          yield* harness.writeFile("first.txt", "");

          const lines = yield* makeStreamTestHarness(
            harness.fileMonitor.streamLatestFileLines({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
              startFrom: "end",
            }),
          );

          yield* harness.awaitSourceRequest;
          yield* harness.emitFile("first.txt");

          yield* harness.awaitSourceRequest;

          yield* harness.appendFile("first.txt", "first file line\n");

          yield* harness.emitFile("first.txt");

          const firstFileLine = yield* lines.take;

          expect(firstFileLine).toBe("first file line");

          // The first-file update has been fully processed.
          yield* harness.awaitSourceRequest;

          yield* harness.writeFile("second.txt", "second file existing line\n");

          yield* harness.emitFile("second.txt");

          const secondFileExistingLine = yield* lines.take;

          expect(secondFileExistingLine).toBe("second file existing line");

          /*
           * The file switch has been processed and FileMonitor is now
           * tracking second.txt.
           */
          yield* harness.awaitSourceRequest;

          yield* harness.appendFile(
            "second.txt",
            "second file appended line\n",
          );

          yield* harness.emitFile("second.txt");

          const secondFileAppendedLine = yield* lines.take;

          expect([
            firstFileLine,
            secondFileExistingLine,
            secondFileAppendedLine,
          ]).toEqual([
            "first file line",
            "second file existing line",
            "second file appended line",
          ]);
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });

    test("restarts from the beginning when the monitored file is truncated", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          yield* harness.writeFile(
            "fellowship.txt",
            "existing content that is intentionally longer\n",
          );

          const lines = yield* makeStreamTestHarness(
            harness.fileMonitor.streamLatestFileLines({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
              startFrom: "end",
            }),
          );

          yield* harness.awaitSourceRequest;
          yield* harness.emitFile("fellowship.txt");

          yield* harness.awaitSourceRequest;

          yield* harness.appendFile("fellowship.txt", "first appended line\n");

          yield* harness.emitFile("fellowship.txt");

          const firstAppendedLine = yield* lines.take;

          expect(firstAppendedLine).toBe("first appended line");

          /*
           * The appended bytes have been processed, so FileMonitor's current
           * byte offset is beyond the size of the replacement contents below.
           */
          yield* harness.awaitSourceRequest;

          yield* harness.truncateFile("fellowship.txt");
          yield* harness.appendFile("fellowship.txt", "after truncate\n");

          yield* harness.emitFile("fellowship.txt");

          const afterTruncate = yield* lines.take;

          expect([firstAppendedLine, afterTruncate]).toEqual([
            "first appended line",
            "after truncate",
          ]);
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });

    test("fails when FileMonitorSource fails", async () => {
      const sourceError = PlatformError.systemError({
        _tag: "Unknown",
        description: "Test source failure.",
        method: "watch",
        module: "FileSystem",
      });

      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          const lines = harness.fileMonitor.streamLatestFileLines({
            directoryPath: harness.directoryPath,
            matches: matchesTextFile,
            startFrom: "end",
          });

          const resultFiber = yield* lines.pipe(
            Stream.runCollect,
            E.result,
            E.forkScoped,
          );

          yield* harness.awaitSourceRequest;
          yield* harness.emitNoFile;

          yield* harness.awaitSourceRequest;
          yield* harness.emitSourceFailure(sourceError);

          const result = yield* Fiber.join(resultFiber);

          expect(Result.isFailure(result)).toBe(true);

          if (Result.isFailure(result)) {
            expect(result.failure).toBe(sourceError);
          }
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });

    test("decodes a UTF-8 character split across appended reads", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          yield* harness.writeFile("fellowship.txt", "");

          const lines = yield* makeStreamTestHarness(
            harness.fileMonitor.streamLatestFileLines({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
              startFrom: "end",
            }),
          );

          yield* harness.awaitSourceRequest;
          yield* harness.emitFile("fellowship.txt");

          yield* harness.awaitSourceRequest;

          const encodedLine = new TextEncoder().encode("café\n");

          /*
           * "é" is two bytes in UTF-8. Split between those two bytes so the
           * TextDecoder has to preserve incomplete decoder state between reads.
           */
          const firstBytes = encodedLine.slice(0, 4);
          const secondBytes = encodedLine.slice(4);

          yield* harness.appendFileBytes("fellowship.txt", firstBytes);
          yield* harness.emitFile("fellowship.txt");

          /*
           * The first update ends halfway through "é", so no complete line
           * should be emitted. Reaching the next request proves that update was
           * processed.
           */
          yield* harness.awaitSourceRequest;

          yield* harness.appendFileBytes("fellowship.txt", secondBytes);
          yield* harness.emitFile("fellowship.txt");

          const line = yield* lines.take;

          expect(line).toBe("café");
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });

    test("resumes with a new matching file after the monitored file disappears", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          yield* harness.writeFile("first.txt", "");

          const lines = yield* makeStreamTestHarness(
            harness.fileMonitor.streamLatestFileLines({
              directoryPath: harness.directoryPath,
              matches: matchesTextFile,
              startFrom: "end",
            }),
          );

          yield* harness.awaitSourceRequest;
          yield* harness.emitFile("first.txt");

          yield* harness.awaitSourceRequest;

          yield* harness.appendFile("first.txt", "first file line\n");
          yield* harness.emitFile("first.txt");

          const firstFileLine = yield* lines.take;

          expect(firstFileLine).toBe("first file line");

          yield* harness.awaitSourceRequest;

          yield* harness.removeFile("first.txt");
          yield* harness.emitNoFile;

          /*
           * The missing-file snapshot has been processed while preserving the
           * previous read state for comparison with the next discovered file.
           */
          yield* harness.awaitSourceRequest;

          yield* harness.writeFile("second.txt", "second file existing line\n");
          yield* harness.emitFile("second.txt");

          const secondFileLine = yield* lines.take;

          expect(secondFileLine).toBe("second file existing line");
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });

    test("fails when the monitored file disappears before appended bytes can be read", async () => {
      const program = E.scoped(
        E.gen(function* () {
          const harness = yield* makeFileMonitorTestHarness();

          yield* harness.writeFile("fellowship.txt", "");

          const lines = harness.fileMonitor.streamLatestFileLines({
            directoryPath: harness.directoryPath,
            matches: matchesTextFile,
            startFrom: "end",
          });

          const resultFiber = yield* lines.pipe(
            Stream.runCollect,
            E.result,
            E.forkScoped,
          );

          yield* harness.awaitSourceRequest;
          yield* harness.emitFile("fellowship.txt");

          /*
           * The initial snapshot has been processed and FileMonitor has
           * established its byte offset at the end of the empty file.
           */
          yield* harness.awaitSourceRequest;

          yield* harness.appendFile("fellowship.txt", "appended line\n");

          /*
           * Capture the source snapshot while the file still exists. This
           * snapshot tells FileMonitor that there are appended bytes to read.
           */
          const updatedFile = yield* harness.getFileData("fellowship.txt");

          /*
           * Simulate the file disappearing after FileMonitorSource observed it
           * but before FileMonitor gets a chance to read the appended bytes.
           */
          yield* harness.removeFile("fellowship.txt");
          yield* harness.emitSourceValue(Option.some(updatedFile));

          const result = yield* Fiber.join(resultFiber);

          expect(Result.isFailure(result)).toBe(true);
        }),
      ).pipe(E.provide(FileMonitorTestDependenciesLive));

      await runTest(program);
    });
  });
});
