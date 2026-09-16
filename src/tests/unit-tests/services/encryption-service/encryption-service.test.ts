import * as E from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { describe, expect, test } from "vitest";

import { makeEncryptionHarness } from "@/tests/common/harnesses/encryption-harness.ts";
import { runTest } from "@/tests/common/run-test.ts";

describe("Encryption", () => {
  test("encrypts and decrypts a value", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const { encryption } = yield* makeEncryptionHarness();

        const value = Redacted.make("secret-value");

        const encryptedValue = yield* encryption.encrypt(value);
        const decryptedValue = yield* encryption.decrypt(encryptedValue);

        expect(Redacted.value(decryptedValue)).toBe("secret-value");
      }),
    );

    await runTest(program);
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

  test("encrypts and decrypts unicode text", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const { encryption } = yield* makeEncryptionHarness();

        const value = Redacted.make("Fellowship 🔐 日本語");

        const encryptedValue = yield* encryption.encrypt(value);
        const decryptedValue = yield* encryption.decrypt(encryptedValue);

        expect(Redacted.value(decryptedValue)).toBe("Fellowship 🔐 日本語");
      }),
    );

    await runTest(program);
  });
});
