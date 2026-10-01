import * as E from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { describe, expect, test } from "vitest";

import { makeEncryptionHarness } from "@frt/api/tests/common/harnesses/encryption-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

function roundTrip(plaintext: string) {
  return E.gen(function* () {
    const { encryption } = yield* makeEncryptionHarness();

    const encryptedValue = yield* encryption.encrypt(Redacted.make(plaintext));
    const decryptedValue = yield* encryption.decrypt(encryptedValue);

    return Redacted.value(decryptedValue);
  }).pipe(E.scoped, runTest);
}

describe("Encryption", () => {
  describe("round trip", () => {
    test("encrypts and decrypts a value", async () => {
      expect(await roundTrip("secret-value")).toBe("secret-value");
    });

    test("encrypts and decrypts unicode text", async () => {
      expect(await roundTrip("Fellowship 🔐 日本語")).toBe(
        "Fellowship 🔐 日本語",
      );
    });
  });

  test("produces different encrypted values for the same plaintext", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const { encryption } = yield* makeEncryptionHarness();

        const value = Redacted.make("secret-value");

        const firstEncryptedValue = yield* encryption.encrypt(value);
        const secondEncryptedValue = yield* encryption.encrypt(value);

        expect(firstEncryptedValue).not.toBe(secondEncryptedValue);
      }),
    );

    await runTest(program);
  });
});
