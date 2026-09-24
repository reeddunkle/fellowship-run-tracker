import * as Data from "effect/Data";

const OPERATION_DESCRIPTIONS = {
  Compress: "compress a Fellowship Logs response for the cache",
  Decompress: "decompress a cached Fellowship Logs response",
} as const;

export class FellowshipLogsResponseCacheCompressionError extends Data.TaggedError(
  "FellowshipLogsResponseCacheCompressionError",
)<{
  readonly cause: unknown;
  readonly operation: keyof typeof OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Failed to ${OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}
