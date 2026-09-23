import { NodeServices } from "@effect/platform-node";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { describe, expect, test } from "vitest";

import { Encryption } from "@frt/api/services/encryption/encryption-service.ts";
import { makeEncryptionKeyStorageTestLayer } from "@frt/api/tests/common/layers/encryption-key-storage-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

describe("Encryption persistence", () => {
  test("decrypts a value using a reconstructed encryption service", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;

        const encryptionKeyDirectory =
          yield* fileSystem.makeTempDirectoryScoped();

        const firstEncryptionKeyStorageLive = makeEncryptionKeyStorageTestLayer(
          encryptionKeyDirectory,
        );

        const FirstEncryptionLive = Encryption.layerNoDeps.pipe(
          Layer.provide(firstEncryptionKeyStorageLive),
        );

        const firstEncryption = yield* Encryption.pipe(
          E.provide(FirstEncryptionLive),
        );

        const encryptedValue = yield* firstEncryption.encrypt(
          Redacted.make("secret-value"),
        );

        const secondEncryptionKeyStorageLive =
          makeEncryptionKeyStorageTestLayer(encryptionKeyDirectory);

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
