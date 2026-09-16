import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Semaphore from "effect/Semaphore";

import { EncryptionKeyStorageError } from "@/errors/encryption-error.ts";

const ENCRYPTION_KEY_FILENAME = "encryption.key";
const ENCRYPTION_KEY_LENGTH_BYTES = 32;

export type EncryptionKey = Redacted.Redacted<Uint8Array>;

export type EncryptionKeyStorageShape = {
  readonly getOrCreateKey: () => E.Effect<
    EncryptionKey,
    EncryptionKeyStorageError
  >;
};

export class EncryptionKeyStorage extends Context.Service<
  EncryptionKeyStorage,
  EncryptionKeyStorageShape
>()(
  "fellowship-run-tracker/services/encryption/encryption-key-storage-service/EncryptionKeyStorage",
) {}

export function makeEncryptionKeyStorageLive({
  encryptionKeyDirectory,
}: {
  readonly encryptionKeyDirectory: string;
}) {
  return Layer.effect(
    EncryptionKeyStorage,
    E.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const semaphore = yield* Semaphore.make(1);

      const readKey = E.fn("EncryptionKeyStorage.readKey")(function* (
        keyPath: string,
      ) {
        const key = yield* fileSystem.readFile(keyPath).pipe(
          E.mapError((cause) => {
            return new EncryptionKeyStorageError({
              cause,
              operation: "ReadKey",
              path: keyPath,
            });
          }),
        );

        if (key.byteLength !== ENCRYPTION_KEY_LENGTH_BYTES) {
          return yield* new EncryptionKeyStorageError({
            cause: new Error(
              `Expected ${ENCRYPTION_KEY_LENGTH_BYTES}-byte encryption key, received ${key.byteLength} bytes.`,
            ),
            operation: "ReadKey",
            path: keyPath,
          });
        }

        return Redacted.make(Uint8Array.from(key));
      });

      const generateKey = E.fn("EncryptionKeyStorage.generateKey")(
        function* () {
          return yield* E.try({
            catch: (cause) => {
              return new EncryptionKeyStorageError({
                cause,
                operation: "GenerateKey",
              });
            },
            try: () => {
              const key = new Uint8Array(ENCRYPTION_KEY_LENGTH_BYTES);

              crypto.getRandomValues(key);

              return Redacted.make(key);
            },
          });
        },
      );

      const writeKey = E.fn("EncryptionKeyStorage.writeKey")(function* (
        keyPath: string,
        key: EncryptionKey,
      ) {
        yield* fileSystem
          .writeFile(keyPath, Redacted.value(key), {
            flag: "wx",
            mode: 0o600,
          })
          .pipe(
            E.mapError((cause) => {
              return new EncryptionKeyStorageError({
                cause,
                operation: "WriteKey",
                path: keyPath,
              });
            }),
          );
      });

      const getOrCreateKey: EncryptionKeyStorageShape["getOrCreateKey"] =
        () => {
          return semaphore.withPermits(1)(
            E.gen(function* () {
              const keyPath = path.join(
                encryptionKeyDirectory,
                ENCRYPTION_KEY_FILENAME,
              );

              const keyExists = yield* fileSystem.exists(keyPath).pipe(
                E.mapError((cause) => {
                  return new EncryptionKeyStorageError({
                    cause,
                    operation: "CheckKeyExists",
                    path: keyPath,
                  });
                }),
              );

              if (keyExists) {
                return yield* readKey(keyPath);
              }

              yield* fileSystem
                .makeDirectory(encryptionKeyDirectory, {
                  mode: 0o700,
                  recursive: true,
                })
                .pipe(
                  E.mapError((cause) => {
                    return new EncryptionKeyStorageError({
                      cause,
                      operation: "CreateDirectory",
                      path: encryptionKeyDirectory,
                    });
                  }),
                );

              const key = yield* generateKey();

              yield* writeKey(keyPath, key);

              return key;
            }),
          );
        };

      return {
        getOrCreateKey,
      } satisfies EncryptionKeyStorageShape;
    }),
  );
}
