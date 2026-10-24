import { Buffer } from "node:buffer";

import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { ProtectedValueStorageError } from "@frt/api/errors/protected-value-storage-error.ts";
import { Encryption } from "@frt/api/services/encryption/encryption-service.ts";
import {
  makeLocalProtectedValueStorage,
  ProtectedValueStorage,
  type ProtectedValueStorageShape,
} from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import { ProtectedValueSchema } from "@frt/db/validation/encryption/protected-value-schema.ts";

export type SafeStorageAdapter = {
  readonly decryptString: (encrypted: Buffer) => string;
  readonly encryptString: (plainText: string) => Buffer;
  readonly isEncryptionAvailable: () => boolean;
};

const decodeProtectedValue = Schema.decodeUnknownEffect(ProtectedValueSchema);
const encodeProtectedValue = Schema.encodeEffect(ProtectedValueSchema);

export function makeElectronProtectedValueStorage(
  safeStorage: SafeStorageAdapter,
  localStorage: ProtectedValueStorageShape,
): ProtectedValueStorageShape {
  const isOsProtectionAvailable = () => {
    return E.try({
      catch: (cause) => {
        return new ProtectedValueStorageError({
          cause,
          operation: "CheckAvailability",
        });
      },
      try: () => safeStorage.isEncryptionAvailable(),
    });
  };

  const getProtectionStatus: ProtectedValueStorageShape["getProtectionStatus"] =
    E.fn("ProtectedValueStorage.getProtectionStatus")(function* () {
      const isAvailable = yield* isOsProtectionAvailable();

      return isAvailable
        ? {
            activeProtection: "OS_BACKED" as const,
            requiresLocalFallbackAcknowledgement: false,
          }
        : yield* localStorage.getProtectionStatus();
    });

  const protect: ProtectedValueStorageShape["protect"] = E.fn(
    "ProtectedValueStorage.protect",
  )(function* (value, options) {
    const isAvailable = yield* isOsProtectionAvailable();

    if (!isAvailable) {
      return yield* localStorage.protect(value, options);
    }

    const encrypted = yield* E.try({
      catch: (cause) => {
        return new ProtectedValueStorageError({
          cause,
          operation: "Protect",
        });
      },
      try: () => safeStorage.encryptString(Redacted.value(value)),
    });

    return yield* encodeProtectedValue({
      protection: "OS_BACKED",
      value: encrypted.toString("base64url"),
      version: 1,
    }).pipe(
      E.mapError((cause) => {
        return new ProtectedValueStorageError({
          cause,
          operation: "Encode",
        });
      }),
    );
  });

  const unprotect: ProtectedValueStorageShape["unprotect"] = E.fn(
    "ProtectedValueStorage.unprotect",
  )(function* (value) {
    const envelope = yield* decodeProtectedValue(value).pipe(
      E.mapError((cause) => {
        return new ProtectedValueStorageError({
          cause,
          operation: "Decode",
        });
      }),
    );

    if (envelope.protection === "LOCAL_KEY") {
      return yield* localStorage.unprotect(value);
    }

    return yield* E.try({
      catch: (cause) => {
        return new ProtectedValueStorageError({
          cause,
          operation: "Unprotect",
        });
      },
      try: () => {
        const encrypted = Buffer.from(envelope.value, "base64url");

        return Redacted.make(safeStorage.decryptString(encrypted));
      },
    });
  });

  return {
    getProtectionStatus,
    protect,
    unprotect,
  };
}

export function makeElectronProtectedValueStorageLayer(
  safeStorage: SafeStorageAdapter,
) {
  return Layer.effect(
    ProtectedValueStorage,
    E.gen(function* () {
      const encryption = yield* Encryption;
      const localStorage = makeLocalProtectedValueStorage(encryption);

      return makeElectronProtectedValueStorage(safeStorage, localStorage);
    }),
  ).pipe(Layer.provide(Encryption.layer));
}
