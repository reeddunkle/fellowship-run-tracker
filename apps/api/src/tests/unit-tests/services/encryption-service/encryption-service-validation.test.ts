import { Buffer } from "node:buffer";

import * as E from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { type EncryptionShape } from "@frt/api/services/encryption/encryption-service.ts";
import { makeEncryptionHarness } from "@frt/api/tests/common/harnesses/encryption-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import {
  ENCRYPTION_ALGORITHM_LABEL,
  type EncryptedValue,
  EncryptedValueSchema,
} from "@frt/db/validation/encryption/encrypted-value-schema.ts";

const decodeEncryptedValue = Schema.decodeUnknownEffect(EncryptedValueSchema);
const encodeEncryptedValue = Schema.encodeEffect(EncryptedValueSchema);

async function decryptExpectingFailure<Error>(
  makeEncryptedValue: (
    encryption: EncryptionShape,
  ) => E.Effect<EncryptedValue, Error>,
) {
  const error = await E.gen(function* () {
    const { encryption } = yield* makeEncryptionHarness();

    const encryptedValue = yield* makeEncryptedValue(encryption);

    return yield* encryption.decrypt(encryptedValue).pipe(E.flip);
  }).pipe(E.scoped, runTest);

  expect(error._tag).toBe("EncryptionError");
  expect(error.operation).toBe("Decrypt");

  return error;
}

describe("Encryption validation", () => {
  describe("fails to decrypt", () => {
    test("a malformed encrypted value", async () => {
      await decryptExpectingFailure(() => {
        return E.succeed("not-json" as EncryptedValue);
      });
    });

    test("an unsupported envelope version", async () => {
      await decryptExpectingFailure(() => {
        return E.succeed(
          JSON.stringify({
            algorithm: ENCRYPTION_ALGORITHM_LABEL,
            ciphertext: "ciphertext",
            iv: "iv",
            version: 2,
          }) as EncryptedValue,
        );
      });
    });

    test("an envelope with an invalid IV length", async () => {
      const error = await decryptExpectingFailure(() => {
        return encodeEncryptedValue({
          algorithm: ENCRYPTION_ALGORITHM_LABEL,
          ciphertext: "ciphertext",
          iv: Buffer.from(new Uint8Array(11)).toString("base64url"),
          version: 1,
        });
      });

      expect(error.cause).toBeInstanceOf(Error);
      expect((error.cause as Error).message).toBe(
        "Expected 12-byte encryption IV, received 11 bytes.",
      );
    });

    test("tampered ciphertext", async () => {
      await decryptExpectingFailure((encryption) => {
        return E.gen(function* () {
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

          return yield* encodeEncryptedValue({
            ...envelope,
            ciphertext: ciphertext.toString("base64url"),
          });
        });
      });
    });
  });
});
