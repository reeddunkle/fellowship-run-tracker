import * as E from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { describe, expect, test, vi } from "vitest";

import { type EncryptionShape } from "@frt/api/services/encryption/encryption-service.ts";
import {
  makeLocalProtectedValueStorage,
  type ProtectedValueStorageShape,
} from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import {
  ENCRYPTION_ALGORITHM_LABEL,
  EncryptedValueSchema,
} from "@frt/db/validation/encryption/encrypted-value-schema.ts";
import { ProtectedValueSchema } from "@frt/db/validation/encryption/protected-value-schema.ts";

const runPromise = E.runPromise;
const encodeEncryptedValue = Schema.encodeSync(EncryptedValueSchema);
const decodeProtectedValue = Schema.decodeSync(ProtectedValueSchema);

const encryptedValue = encodeEncryptedValue({
  algorithm: ENCRYPTION_ALGORITHM_LABEL,
  ciphertext: "ciphertext",
  iv: "initialization-vector",
  version: 1,
});

function makeEncryption(): EncryptionShape {
  return {
    decrypt: vi.fn(() => E.succeed(Redacted.make("secret-value"))),
    encrypt: vi.fn(() => E.succeed(encryptedValue)),
  };
}

function protect(
  storage: ProtectedValueStorageShape,
  allowLocalFallback: boolean,
) {
  return storage.protect(Redacted.make("secret-value"), {
    allowLocalFallback,
  });
}

describe("local protected value storage", () => {
  test("reports that local protection requires acknowledgement", async () => {
    const storage = makeLocalProtectedValueStorage(makeEncryption());

    await expect(runPromise(storage.getProtectionStatus())).resolves.toEqual({
      activeProtection: "LOCAL_KEY",
      requiresLocalFallbackAcknowledgement: true,
    });
  });

  test("rejects protection without local fallback acknowledgement", async () => {
    const storage = makeLocalProtectedValueStorage(makeEncryption());

    const error = await runPromise(protect(storage, false).pipe(E.flip));

    expect(error._tag).toBe("LocalProtectionAcknowledgementRequiredError");
  });

  test("protects and unprotects acknowledged local values", async () => {
    const encryption = makeEncryption();
    const storage = makeLocalProtectedValueStorage(encryption);

    const protectedValue = await runPromise(protect(storage, true));
    const envelope = decodeProtectedValue(protectedValue);
    const result = await runPromise(storage.unprotect(protectedValue));

    expect(envelope).toEqual({
      protection: "LOCAL_KEY",
      value: encryptedValue,
      version: 1,
    });
    expect(Redacted.value(result)).toBe("secret-value");
    expect(encryption.encrypt).toHaveBeenCalledOnce();
    expect(encryption.decrypt).toHaveBeenCalledWith(encryptedValue);
  });
});
