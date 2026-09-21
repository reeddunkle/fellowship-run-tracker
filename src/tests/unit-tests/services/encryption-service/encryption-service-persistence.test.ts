import { NodeServices } from "@effect/platform-node";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { describe, expect, test } from "vitest";

import { EncryptionKeyStorage } from "@/services/encryption/encryption-key-storage-service.ts";
import { Encryption } from "@/services/encryption/encryption-service.ts";
import { runTest } from "@/tests/common/run-test.ts";

describe("Encryption persistence", () => {
  test("decrypts a value using a reconstructed encryption service", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;

        const encryptionKeyDirectory =
          yield* fileSystem.makeTempDirectoryScoped();

        const firstEncryptionKeyStorageLive = EncryptionKeyStorage.layerWith({
          encryptionKeyDirectory,
        });

        const FirstEncryptionLive = Encryption.layerNoDeps.pipe(
          Layer.provide(firstEncryptionKeyStorageLive),
        );

        const firstEncryption = yield* Encryption.pipe(
          E.provide(FirstEncryptionLive),
        );

        const encryptedValue = yield* firstEncryption.encrypt(
          Redacted.make("secret-value"),
        );

        const secondEncryptionKeyStorageLive = EncryptionKeyStorage.layerWith({
          encryptionKeyDirectory,
        });

        const SecondEncryptionLive = Encryption.layerNoDeps.pipe(
          Layer.provide(secondEncryptionKeyStorageLive),
        );

        const secondEncryption = yield* Encryption.pipe(
          E.provide(SecondEncryptionLive),
        );

        const decryptedValue = yield* secondEncryption.decrypt(encryptedValue);

        expect(Redacted.value(decryptedValue)).toBe("secret-value");
      }),
    ).pipe(E.provide(NodeServices.layer));

    await runTest(program);
  });
});
