import * as Data from "effect/Data";

const ENCRYPTION_OPERATION_DESCRIPTIONS = {
  Decrypt: "decrypt a value",
  Encrypt: "encrypt a value",
} as const;

export class EncryptionError extends Data.TaggedError("EncryptionError")<{
  readonly cause: unknown;
  readonly operation: keyof typeof ENCRYPTION_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Failed to ${ENCRYPTION_OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}

const ENCRYPTION_KEY_STORAGE_OPERATION_DESCRIPTIONS = {
  CheckKeyExists: "check whether the encryption key exists",
  CreateDirectory: "create the encryption key directory",
  GenerateKey: "generate an encryption key",
  ReadKey: "read the encryption key",
  WriteKey: "write the encryption key",
} as const;

export class EncryptionKeyStorageError extends Data.TaggedError(
  "EncryptionKeyStorageError",
)<{
  readonly cause: unknown;
  readonly operation: keyof typeof ENCRYPTION_KEY_STORAGE_OPERATION_DESCRIPTIONS;
  readonly path?: string;
}> {
  override get message() {
    const description =
      ENCRYPTION_KEY_STORAGE_OPERATION_DESCRIPTIONS[this.operation];

    return this.path === undefined
      ? `Failed to ${description}.`
      : `Failed to ${description}: ${this.path}.`;
  }
}
