import * as Schema from "effect/Schema";

import { EncryptedValueEncodedSchema } from "@frt/db/validation/encryption/encrypted-value-schema.ts";

const ProtectedValueEnvelopeSchema = Schema.Union([
  Schema.Struct({
    protection: Schema.Literal("OS_BACKED"),
    value: Schema.NonEmptyString,
    version: Schema.Literal(1),
  }),
  Schema.Struct({
    protection: Schema.Literal("LOCAL_KEY"),
    value: EncryptedValueEncodedSchema,
    version: Schema.Literal(1),
  }),
]);

export const ProtectedValueSchema = Schema.fromJsonString(
  ProtectedValueEnvelopeSchema,
);

export type ProtectedValue = typeof ProtectedValueSchema.Encoded;

export const ProtectedValueEncodedSchema =
  Schema.toEncoded(ProtectedValueSchema);
