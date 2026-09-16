import * as Data from "effect/Data";

export class EncryptionError extends Data.TaggedError("EncryptionError")<{
  readonly cause: unknown;
  readonly operation: "Decrypt" | "Encrypt";
}> {}

export class EncryptionKeyStorageError extends Data.TaggedError(
  "EncryptionKeyStorageError",
)<{
  readonly cause: unknown;
  readonly operation:
    | "CheckKeyExists"
    | "CreateDirectory"
    | "GenerateKey"
    | "ReadKey"
    | "WriteKey";
  readonly path?: string;
}> {}
