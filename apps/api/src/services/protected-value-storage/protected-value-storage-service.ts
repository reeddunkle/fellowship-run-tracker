import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import {
  LocalProtectionAcknowledgementRequiredError,
  ProtectedValueStorageError,
} from "@frt/api/errors/protected-value-storage-error.ts";
import {
  type ProtectedValue,
  ProtectedValueSchema,
} from "@frt/db/validation/encryption/protected-value-schema.ts";

import {
  Encryption,
  type EncryptionShape,
} from "../encryption/encryption-service.ts";

type ProtectionStatus = {
  readonly activeProtection: "LOCAL_KEY" | "OS_BACKED";
  readonly requiresLocalFallbackAcknowledgement: boolean;
};

type ProtectValueOptions = {
  readonly allowLocalFallback: boolean;
};

export type ProtectedValueStorageShape = {
  readonly getProtectionStatus: () => E.Effect<
    ProtectionStatus,
    ProtectedValueStorageError
  >;

  readonly protect: (
    value: Redacted.Redacted<string>,
    options: ProtectValueOptions,
  ) => E.Effect<
    ProtectedValue,
    LocalProtectionAcknowledgementRequiredError | ProtectedValueStorageError
  >;

  readonly unprotect: (
    value: ProtectedValue,
  ) => E.Effect<Redacted.Redacted<string>, ProtectedValueStorageError>;
};

const decodeProtectedValue = Schema.decodeUnknownEffect(ProtectedValueSchema);
const encodeProtectedValue = Schema.encodeEffect(ProtectedValueSchema);

export function makeLocalProtectedValueStorage(
  encryption: EncryptionShape,
): ProtectedValueStorageShape {
  const getProtectionStatus: ProtectedValueStorageShape["getProtectionStatus"] =
    () =>
      E.succeed({
        activeProtection: "LOCAL_KEY" as const,
        requiresLocalFallbackAcknowledgement: true,
      });

  const protect: ProtectedValueStorageShape["protect"] = E.fn(
    "ProtectedValueStorage.protect",
  )(function* (value, options) {
    if (!options.allowLocalFallback) {
      return yield* new LocalProtectionAcknowledgementRequiredError();
    }

    const encryptedValue = yield* encryption.encrypt(value).pipe(
      E.mapError((cause) => {
        return new ProtectedValueStorageError({
          cause,
          operation: "Protect",
        });
      }),
    );

    return yield* encodeProtectedValue({
      protection: "LOCAL_KEY",
      value: encryptedValue,
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

    if (envelope.protection === "OS_BACKED") {
      return yield* new ProtectedValueStorageError({
        cause: new Error(
          "OS-backed values require an OS-backed protection provider.",
        ),
        operation: "Unprotect",
      });
    }

    return yield* encryption.decrypt(envelope.value).pipe(
      E.mapError((cause) => {
        return new ProtectedValueStorageError({
          cause,
          operation: "Unprotect",
        });
      }),
    );
  });

  return {
    getProtectionStatus,
    protect,
    unprotect,
  };
}

const makeLocalProtectedValueStorageEffect = E.gen(function* () {
  const encryption = yield* Encryption;

  return makeLocalProtectedValueStorage(encryption);
});

export class ProtectedValueStorage extends Context.Service<
  ProtectedValueStorage,
  ProtectedValueStorageShape
>()(
  "@frt/api/services/protected-value-storage/protected-value-storage-service/ProtectedValueStorage",
) {
  static readonly localLayerNoDeps = Layer.effect(
    this,
    makeLocalProtectedValueStorageEffect,
  );

  static readonly localLayer = this.localLayerNoDeps.pipe(
    Layer.provide(Encryption.layer),
  );
}
