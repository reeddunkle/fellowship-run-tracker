import * as Schema from "effect/Schema";

export const ENCRYPTION_ALGORITHM_LABEL = "AES-256-GCM";
export const ENCRYPTION_ALGORITHM = "AES-GCM";
export const ENCRYPTION_IV_LENGTH_BYTES = 12;

const EncryptedValueEnvelopeSchema = Schema.Struct({
  algorithm: Schema.Literal(ENCRYPTION_ALGORITHM_LABEL),
  ciphertext: Schema.NonEmptyString,
  iv: Schema.NonEmptyString,
  version: Schema.Literal(1),
});

export const EncryptedValueSchema = Schema.fromJsonString(
  EncryptedValueEnvelopeSchema,
);

export type EncryptedValue = typeof EncryptedValueSchema.Encoded;

export const EncryptedValueEncodedSchema =
  Schema.toEncoded(EncryptedValueSchema);
