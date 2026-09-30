import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as PlatformError from "effect/PlatformError";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import * as Result from "effect/Result";
import { describe, expect, test } from "vitest";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

import { layerAtomicFileSystem } from "@/services/app-state-store/persistence/atomic-file-system-key-value-store.ts";

function makeRenameFailure() {
  return PlatformError.systemError({
    _tag: "Busy",
    description: "Test rename failure.",
    method: "rename",
    module: "FileSystem",
  });
}

function withFailingRenames<A, Error, Requirements>(
  shouldRenameFail: () => boolean,
  program: (
    directory: string,
  ) => E.Effect<A, Error, Requirements | KeyValueStore.KeyValueStore>,
) {
  return E.scoped(
    E.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;

      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "atomic-key-value-store-",
      });

      const failingFileSystem = {
        ...fileSystem,
        rename: (oldPath: string, newPath: string) => {
          return E.suspend(() => {
            return shouldRenameFail()
              ? E.fail(makeRenameFailure())
              : fileSystem.rename(oldPath, newPath);
          });
        },
      } satisfies FileSystem.FileSystem;

      return yield* program(directory).pipe(
        E.provide(layerAtomicFileSystem(directory)),
        E.provideService(FileSystem.FileSystem, failingFileSystem),
      );
    }),
  ).pipe(E.provide(NodePlatformLayer));
}

describe("layerAtomicFileSystem", () => {
  test("keeps the previous value when replacing it fails", async () => {
    let isRenameFailing = false;

    const program = withFailingRenames(
      () => {
        return isRenameFailing;
      },
      () => {
        return E.gen(function* () {
          const keyValueStore = yield* KeyValueStore.KeyValueStore;

          yield* keyValueStore.set("app-state", "first");

          isRenameFailing = true;

          const replaceResult = yield* E.result(
            keyValueStore.set("app-state", "second"),
          );

          return {
            isReplaceFailure: Result.isFailure(replaceResult),
            value: yield* keyValueStore.get("app-state"),
          };
        });
      },
    );

    expect(await runTest(program)).toEqual({
      isReplaceFailure: true,
      value: "first",
    });
  });

  test("retries a replacement that fails briefly without leaving a temporary file behind", async () => {
    let remainingRenameFailures = 0;

    const program = withFailingRenames(
      () => {
        if (remainingRenameFailures === 0) {
          return false;
        }

        remainingRenameFailures -= 1;

        return true;
      },
      (directory) => {
        return E.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const keyValueStore = yield* KeyValueStore.KeyValueStore;

          yield* keyValueStore.set("app-state", "first");

          remainingRenameFailures = 2;

          yield* keyValueStore.set("app-state", "second");

          return {
            files: yield* fileSystem.readDirectory(directory),
            value: yield* keyValueStore.get("app-state"),
          };
        });
      },
    );

    expect(await runTest(program)).toEqual({
      files: ["app-state"],
      value: "second",
    });
  });
});
