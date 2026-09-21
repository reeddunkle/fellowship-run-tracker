import { Buffer } from "node:buffer";
import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { EncryptionError } from "@/errors/encryption-error.ts";
import {
  ENCRYPTION_ALGORITHM,
  ENCRYPTION_ALGORITHM_LABEL,
  ENCRYPTION_IV_LENGTH_BYTES,
  type EncryptedValue,
  EncryptedValueSchema,
} from "@/services/encryption/validation/encrypted-value-schema.ts";

import { EncryptionKeyStorage } from "./encryption-key-storage-service.ts";

export type EncryptionShape = {
  readonly decrypt: (
    encryptedValue: EncryptedValue,
  ) => E.Effect<Redacted.Redacted<string>, EncryptionError>;

  readonly encrypt: (
    value: Redacted.Redacted<string>,
  ) => E.Effect<EncryptedValue, EncryptionError>;
};

const makeEncryption = E.gen(function* () {
  const encryptionKeyStorage = yield* EncryptionKeyStorage;

  const decodeEncryptedValue = Schema.decodeUnknownEffect(EncryptedValueSchema);
  const encodeEncryptedValue = Schema.encodeEffect(EncryptedValueSchema);

  const getCryptoKey = E.fn("Encryption.getCryptoKey")(function* (
    operation: EncryptionError["operation"],
  ) {
    const encryptionKey = yield* encryptionKeyStorage.getOrCreateKey().pipe(
      E.mapError((cause) => {
        return new EncryptionError({
          cause,
          operation,
        });
      }),
    );

    return yield* E.tryPromise({
      catch: (cause) => {
        return new EncryptionError({
          cause,
          operation,
        });
      },
      try: () => {
        return crypto.subtle.importKey(
          "raw",
          Uint8Array.from(Redacted.value(encryptionKey)),
          {
            name: ENCRYPTION_ALGORITHM,
          },
          false,
          ["decrypt", "encrypt"],
        );
      },
    });
  });

  const encrypt: EncryptionShape["encrypt"] = (value) => {
    return E.gen(function* () {
      const cryptoKey = yield* getCryptoKey("Encrypt");

      const iv = yield* E.try({
        catch: (cause) => {
          return new EncryptionError({
            cause,
            operation: "Encrypt",
          });
        },
        try: () => {
          return crypto.getRandomValues(
            new Uint8Array(ENCRYPTION_IV_LENGTH_BYTES),
          );
        },
      });

      const plaintext = new TextEncoder().encode(Redacted.value(value));

      const ciphertext = yield* E.tryPromise({
        catch: (cause) => {
          return new EncryptionError({
            cause,
            operation: "Encrypt",
          });
        },
        try: () => {
          return crypto.subtle.encrypt(
            {
              iv,
              name: ENCRYPTION_ALGORITHM,
            },
            cryptoKey,
            plaintext,
          );
        },
      });

      return yield* encodeEncryptedValue({
        algorithm: ENCRYPTION_ALGORITHM_LABEL,
        ciphertext: Buffer.from(ciphertext).toString("base64url"),
        iv: Buffer.from(iv).toString("base64url"),
        version: 1,
      }).pipe(
        E.mapError((cause) => {
          return new EncryptionError({
            cause,
            operation: "Encrypt",
          });
        }),
      );
    });
  };

  const decrypt: EncryptionShape["decrypt"] = (encryptedValue) => {
    return E.gen(function* () {
      const envelope = yield* decodeEncryptedValue(encryptedValue).pipe(
        E.mapError((cause) => {
          return new EncryptionError({
            cause,
            operation: "Decrypt",
          });
        }),
      );

      const iv = Uint8Array.from(Buffer.from(envelope.iv, "base64url"));

      if (iv.byteLength !== ENCRYPTION_IV_LENGTH_BYTES) {
        return yield* new EncryptionError({
          cause: new Error(
            `Expected ${ENCRYPTION_IV_LENGTH_BYTES}-byte encryption IV, received ${iv.byteLength} bytes.`,
          ),
          operation: "Decrypt",
        });
      }

      const ciphertext = Uint8Array.from(
        Buffer.from(envelope.ciphertext, "base64url"),
      );

      const cryptoKey = yield* getCryptoKey("Decrypt");

      const decrypted = yield* E.tryPromise({
        catch: (cause) => {
          return new EncryptionError({
            cause,
            operation: "Decrypt",
          });
        },
        try: () => {
          return crypto.subtle.decrypt(
            {
              iv,
              name: ENCRYPTION_ALGORITHM,
            },
            cryptoKey,
            ciphertext,
          );
        },
      });

      return Redacted.make(new TextDecoder().decode(decrypted));
    });
  };

  return {
    decrypt,
    encrypt,
  } satisfies EncryptionShape;
});

export class Encryption extends Context.Service<Encryption, EncryptionShape>()(
  "fellowship-run-tracker/services/encryption/encryption-service/Encryption",
) {
  static readonly layerNoDeps = Layer.effect(this, makeEncryption);

  static readonly layerWith = (options: {
    readonly encryptionKeyDirectory: string;
  }) => {
    return this.layerNoDeps.pipe(
      Layer.provide(EncryptionKeyStorage.layerWith(options)),
    );
  };
}
