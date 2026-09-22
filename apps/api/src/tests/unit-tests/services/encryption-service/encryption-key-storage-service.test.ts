import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import { describe, expect, test } from "vitest";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { EncryptionKeyStorage } from "@frt/api/services/encryption/encryption-key-storage-service.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const ENCRYPTION_KEY_FILENAME = "encryption.key";
const ENCRYPTION_KEY_LENGTH_BYTES = 32;

describe("EncryptionKeyStorage", () => {
  test("creates a 32-byte encryption key", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;

        const encryptionKeyDirectory =
          yield* fileSystem.makeTempDirectoryScoped();

        const encryptionKeyStorage = yield* EncryptionKeyStorage.pipe(
          E.provide(
            EncryptionKeyStorage.layerWith({
              encryptionKeyDirectory,
            }),
          ),
        );

        const key = yield* encryptionKeyStorage.getOrCreateKey();

        expect(Redacted.value(key).byteLength).toBe(
          ENCRYPTION_KEY_LENGTH_BYTES,
        );
      }),
    ).pipe(E.provide(NodePlatformLayer));

    await runTest(program);
  });

  test("returns the same key on subsequent calls", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;

        const encryptionKeyDirectory =
          yield* fileSystem.makeTempDirectoryScoped();

        const encryptionKeyStorage = yield* EncryptionKeyStorage.pipe(
          E.provide(
            EncryptionKeyStorage.layerWith({
              encryptionKeyDirectory,
            }),
          ),
        );

        const firstKey = yield* encryptionKeyStorage.getOrCreateKey();
        const secondKey = yield* encryptionKeyStorage.getOrCreateKey();

        expect(Redacted.value(secondKey)).toEqual(Redacted.value(firstKey));
      }),
    ).pipe(E.provide(NodePlatformLayer));

    await runTest(program);
  });

  test("persists the encryption key to disk", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;

        const encryptionKeyDirectory =
          yield* fileSystem.makeTempDirectoryScoped();

        const encryptionKeyStorage = yield* EncryptionKeyStorage.pipe(
          E.provide(
            EncryptionKeyStorage.layerWith({
              encryptionKeyDirectory,
            }),
          ),
        );

        const key = yield* encryptionKeyStorage.getOrCreateKey();

        const keyPath = path.join(
          encryptionKeyDirectory,
          ENCRYPTION_KEY_FILENAME,
        );

        const persistedKey = yield* fileSystem.readFile(keyPath);

        expect(Uint8Array.from(persistedKey)).toEqual(Redacted.value(key));
      }),
    ).pipe(E.provide(NodePlatformLayer));

    await runTest(program);
  });

  test("loads an existing encryption key from disk", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;

        const encryptionKeyDirectory =
          yield* fileSystem.makeTempDirectoryScoped();

        const keyPath = path.join(
          encryptionKeyDirectory,
          ENCRYPTION_KEY_FILENAME,
        );

        const existingKey = new Uint8Array(ENCRYPTION_KEY_LENGTH_BYTES);

        existingKey.fill(42);

        yield* fileSystem.writeFile(keyPath, existingKey);

        const encryptionKeyStorage = yield* EncryptionKeyStorage.pipe(
          E.provide(
            EncryptionKeyStorage.layerWith({
              encryptionKeyDirectory,
            }),
          ),
        );

        const key = yield* encryptionKeyStorage.getOrCreateKey();

        expect(Redacted.value(key)).toEqual(existingKey);
      }),
    ).pipe(E.provide(NodePlatformLayer));

    await runTest(program);
  });

  test("fails when an existing encryption key has an invalid length", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;

        const encryptionKeyDirectory =
          yield* fileSystem.makeTempDirectoryScoped();

        const keyPath = path.join(
          encryptionKeyDirectory,
          ENCRYPTION_KEY_FILENAME,
        );

        yield* fileSystem.writeFile(
          keyPath,
          new Uint8Array(ENCRYPTION_KEY_LENGTH_BYTES - 1),
        );

        const encryptionKeyStorage = yield* EncryptionKeyStorage.pipe(
          E.provide(
            EncryptionKeyStorage.layerWith({
              encryptionKeyDirectory,
            }),
          ),
        );

        const error = yield* encryptionKeyStorage.getOrCreateKey().pipe(E.flip);

        expect(error._tag).toBe("EncryptionKeyStorageError");
        expect(error.operation).toBe("ReadKey");
        expect(error.cause).toBeInstanceOf(Error);
        expect((error.cause as Error).message).toBe(
          "Expected 32-byte encryption key, received 31 bytes.",
        );
      }),
    ).pipe(E.provide(NodePlatformLayer));

    await runTest(program);
  });
});
