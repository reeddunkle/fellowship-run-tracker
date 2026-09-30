import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import { describe, expect, test } from "vitest";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

import { layerAtomicFileSystem } from "@/services/app-state-store/persistence/atomic-file-system-key-value-store.ts";

describe("layerAtomicFileSystem", () => {
  test("replaces a stored value without leaving a temporary file behind", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;

        const directory = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "atomic-key-value-store-",
        });

        return yield* E.gen(function* () {
          const keyValueStore = yield* KeyValueStore.KeyValueStore;

          yield* keyValueStore.set("app-state", "first");
          yield* keyValueStore.set("app-state", "second");

          return {
            files: yield* fileSystem.readDirectory(directory),
            value: yield* keyValueStore.get("app-state"),
          };
        }).pipe(E.provide(layerAtomicFileSystem(directory)));
      }),
    ).pipe(E.provide(NodePlatformLayer));

    expect(await runTest(program)).toEqual({
      files: ["app-state"],
      value: "second",
    });
  });
});
