import { Buffer } from "node:buffer";

import * as E from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { describe, expect, test, vi } from "vitest";

import { LocalProtectionAcknowledgementRequiredError } from "@frt/api/errors/protected-value-storage-error.ts";
import { type ProtectedValueStorageShape } from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import {
  type ProtectedValue,
  ProtectedValueSchema,
} from "@frt/db/validation/encryption/protected-value-schema.ts";

import {
  makeElectronProtectedValueStorage,
  type SafeStorageAdapter,
} from "@/services/protected-value-storage/electron-protected-value-storage.ts";

const runPromise = E.runPromise;
const decodeProtectedValue = Schema.decodeSync(ProtectedValueSchema);
const encodeProtectedValue = Schema.encodeSync(ProtectedValueSchema);

function makeLocalStorage(): ProtectedValueStorageShape {
  return {
    getProtectionStatus: vi.fn(() =>
      E.succeed({
        activeProtection: "LOCAL_KEY" as const,
        requiresLocalFallbackAcknowledgement: true,
      }),
    ),
    protect: vi.fn(() =>
      E.fail(new LocalProtectionAcknowledgementRequiredError()),
    ),
    unprotect: vi.fn(() => E.succeed(Redacted.make("local-secret"))),
  };
}

function makeSafeStorage(isEncryptionAvailable: boolean): SafeStorageAdapter {
  return {
    decryptString: vi.fn((encrypted) => encrypted.toString("utf8")),
    encryptString: vi.fn((plainText) => Buffer.from(plainText, "utf8")),
    isEncryptionAvailable: vi.fn(() => isEncryptionAvailable),
  };
}

describe("electron protected value storage", () => {
  test("reports OS-backed protection availability", async () => {
    const storage = makeElectronProtectedValueStorage(
      makeSafeStorage(true),
      makeLocalStorage(),
    );

    await expect(runPromise(storage.getProtectionStatus())).resolves.toEqual({
      activeProtection: "OS_BACKED",
      requiresLocalFallbackAcknowledgement: false,
    });
  });

  test("maps availability failures", async () => {
    const safeStorage = makeSafeStorage(true);
    vi.mocked(safeStorage.isEncryptionAvailable).mockImplementation(() => {
      throw new Error("availability failed");
    });
    const storage = makeElectronProtectedValueStorage(
      safeStorage,
      makeLocalStorage(),
    );

    const error = await runPromise(storage.getProtectionStatus().pipe(E.flip));

    expect(error).toMatchObject({
      _tag: "ProtectedValueStorageError",
      operation: "CheckAvailability",
    });
  });

  test("protects with OS-backed storage when available", async () => {
    const safeStorage = makeSafeStorage(true);
    const localStorage = makeLocalStorage();
    const storage = makeElectronProtectedValueStorage(
      safeStorage,
      localStorage,
    );

    const protectedValue = await runPromise(
      storage.protect(Redacted.make("secret-value"), {
        allowLocalFallback: false,
      }),
    );

    expect(decodeProtectedValue(protectedValue)).toEqual({
      protection: "OS_BACKED",
      value: Buffer.from("secret-value").toString("base64url"),
      version: 1,
    });
    expect(safeStorage.encryptString).toHaveBeenCalledWith("secret-value");
    expect(localStorage.protect).not.toHaveBeenCalled();
  });

  test("unprotects OS-backed values", async () => {
    const safeStorage = makeSafeStorage(true);
    const storage = makeElectronProtectedValueStorage(
      safeStorage,
      makeLocalStorage(),
    );
    const protectedValue = encodeProtectedValue({
      protection: "OS_BACKED",
      value: Buffer.from("secret-value").toString("base64url"),
      version: 1,
    });

    const result = await runPromise(storage.unprotect(protectedValue));

    expect(Redacted.value(result)).toBe("secret-value");
    expect(safeStorage.decryptString).toHaveBeenCalledWith(
      Buffer.from("secret-value"),
    );
  });

  test("maps OS-backed encryption failures", async () => {
    const safeStorage = makeSafeStorage(true);
    vi.mocked(safeStorage.encryptString).mockImplementation(() => {
      throw new Error("encryption failed");
    });
    const storage = makeElectronProtectedValueStorage(
      safeStorage,
      makeLocalStorage(),
    );

    const error = await runPromise(
      storage
        .protect(Redacted.make("secret-value"), {
          allowLocalFallback: false,
        })
        .pipe(E.flip),
    );

    expect(error).toMatchObject({
      _tag: "ProtectedValueStorageError",
      operation: "Protect",
    });
  });

  test("maps OS-backed decryption failures for corrupted ciphertext", async () => {
    const safeStorage = makeSafeStorage(true);
    vi.mocked(safeStorage.decryptString).mockImplementation(() => {
      throw new Error("ciphertext failed authentication");
    });
    const storage = makeElectronProtectedValueStorage(
      safeStorage,
      makeLocalStorage(),
    );
    const protectedValue = encodeProtectedValue({
      protection: "OS_BACKED",
      value: Buffer.from("corrupted-ciphertext").toString("base64url"),
      version: 1,
    });

    const error = await runPromise(
      storage.unprotect(protectedValue).pipe(E.flip),
    );

    expect(error).toMatchObject({
      _tag: "ProtectedValueStorageError",
      operation: "Unprotect",
    });
  });

  test("rejects malformed protected-value envelopes", async () => {
    const storage = makeElectronProtectedValueStorage(
      makeSafeStorage(true),
      makeLocalStorage(),
    );

    const error = await runPromise(
      storage.unprotect("not-an-envelope" as ProtectedValue).pipe(E.flip),
    );

    expect(error).toMatchObject({
      _tag: "ProtectedValueStorageError",
      operation: "Decode",
    });
  });

  test("delegates unavailable OS protection to local storage", async () => {
    const safeStorage = makeSafeStorage(false);
    const localStorage = makeLocalStorage();
    const storage = makeElectronProtectedValueStorage(
      safeStorage,
      localStorage,
    );
    const options = { allowLocalFallback: false };

    const error = await runPromise(
      storage.protect(Redacted.make("secret-value"), options).pipe(E.flip),
    );

    expect(error._tag).toBe("LocalProtectionAcknowledgementRequiredError");
    expect(localStorage.protect).toHaveBeenCalledWith(
      expect.anything(),
      options,
    );
  });

  test("delegates local-key values regardless of current OS availability", async () => {
    const safeStorage = makeSafeStorage(true);
    const localStorage = makeLocalStorage();
    const storage = makeElectronProtectedValueStorage(
      safeStorage,
      localStorage,
    );
    const protectedValue = encodeProtectedValue({
      protection: "LOCAL_KEY",
      value: JSON.stringify({
        algorithm: "AES-256-GCM",
        ciphertext: "ciphertext",
        iv: "initialization-vector",
        version: 1,
      }),
      version: 1,
    });

    const result = await runPromise(storage.unprotect(protectedValue));

    expect(Redacted.value(result)).toBe("local-secret");
    expect(localStorage.unprotect).toHaveBeenCalledWith(protectedValue);
    expect(safeStorage.decryptString).not.toHaveBeenCalled();
  });
});
