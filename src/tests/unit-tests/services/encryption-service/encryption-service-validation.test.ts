import { Buffer } from "node:buffer";
import * as E from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import {
  ENCRYPTION_ALGORITHM_LABEL,
  type EncryptedValue,
  EncryptedValueSchema,
} from "@/services/encryption/validation/encrypted-value-schema.ts";
import { makeEncryptionHarness } from "@/tests/common/harnesses/encryption-harness.ts";
import { runTest } from "@/tests/common/run-test.ts";

const decodeEncryptedValue = Schema.decodeUnknownEffect(EncryptedValueSchema);
const encodeEncryptedValue = Schema.encodeEffect(EncryptedValueSchema);

describe("Encryption validation", () => {
  test("fails to decrypt malformed encrypted value", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const { encryption } = yield* makeEncryptionHarness();

        const error = yield* encryption
          .decrypt("not-json" as EncryptedValue)
          .pipe(E.flip);

        expect(error._tag).toBe("EncryptionError");
        expect(error.operation).toBe("Decrypt");
      }),
    );

    await runTest(program);
  });

  test("fails to decrypt an unsupported envelope version", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const { encryption } = yield* makeEncryptionHarness();

        const encryptedValue = JSON.stringify({
          algorithm: ENCRYPTION_ALGORITHM_LABEL,
          ciphertext: "ciphertext",
          iv: "iv",
          version: 2,
        }) as EncryptedValue;

        const error = yield* encryption.decrypt(encryptedValue).pipe(E.flip);

        expect(error._tag).toBe("EncryptionError");
        expect(error.operation).toBe("Decrypt");
      }),
    );

    await runTest(program);
  });

  test("fails to decrypt an envelope with an invalid IV length", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const { encryption } = yield* makeEncryptionHarness();

        const encryptedValue = yield* encodeEncryptedValue({
          algorithm: ENCRYPTION_ALGORITHM_LABEL,
          ciphertext: "ciphertext",
          iv: Buffer.from(new Uint8Array(11)).toString("base64url"),
          version: 1,
        });

        const error = yield* encryption.decrypt(encryptedValue).pipe(E.flip);

        expect(error._tag).toBe("EncryptionError");
        expect(error.operation).toBe("Decrypt");
        expect(error.cause).toBeInstanceOf(Error);
        expect((error.cause as Error).message).toBe(
          "Expected 12-byte encryption IV, received 11 bytes.",
        );
      }),
    );

    await runTest(program);
  });

  test("fails to decrypt tampered ciphertext", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const { encryption } = yield* makeEncryptionHarness();

        const encryptedValue = yield* encryption.encrypt(
          Redacted.make("secret-value"),
        );

        const envelope = yield* decodeEncryptedValue(encryptedValue);

        const ciphertext = Buffer.from(envelope.ciphertext, "base64url");
        const firstByte = ciphertext[0];

        if (firstByte === undefined) {
          return yield* E.die(
            new Error(
              "Expected encrypted ciphertext to contain at least one byte.",
            ),
          );
        }

        ciphertext[0] = firstByte ^ 1;

        const tamperedEncryptedValue = yield* encodeEncryptedValue({
          ...envelope,
          ciphertext: ciphertext.toString("base64url"),
        });

        const error = yield* encryption
          .decrypt(tamperedEncryptedValue)
          .pipe(E.flip);

        expect(error._tag).toBe("EncryptionError");
        expect(error.operation).toBe("Decrypt");
      }),
    );

    await runTest(program);
  });
});
