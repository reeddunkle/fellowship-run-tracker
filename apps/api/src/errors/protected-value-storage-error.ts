import * as Data from "effect/Data";

const PROTECTED_VALUE_STORAGE_OPERATION_DESCRIPTIONS = {
  CheckAvailability: "check protected storage availability",
  Decode: "decode a protected value",
  Encode: "encode a protected value",
  Protect: "protect a value",
  Unprotect: "unprotect a value",
} as const;

export class ProtectedValueStorageError extends Data.TaggedError(
  "ProtectedValueStorageError",
)<{
  readonly cause: unknown;
  readonly operation: keyof typeof PROTECTED_VALUE_STORAGE_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Failed to ${PROTECTED_VALUE_STORAGE_OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}

export class LocalProtectionAcknowledgementRequiredError extends Data.TaggedError(
  "LocalProtectionAcknowledgementRequiredError",
)<Record<never, never>> {
  override get message() {
    return "Local-key protection requires explicit acknowledgement.";
  }
}
