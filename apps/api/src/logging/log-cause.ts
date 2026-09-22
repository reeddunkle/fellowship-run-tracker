import * as Cause from "effect/Cause";
import * as E from "effect/Effect";
import * as Result from "effect/Result";

export function logCause(cause: Cause.Cause<unknown>): E.Effect<void> {
  if (Cause.hasInterruptsOnly(cause)) {
    return E.void;
  }

  const prettyCause = Cause.pretty(cause);

  if (Cause.hasDies(cause)) {
    return E.logFatal("[DEFECT] Unexpected application defect.", {
      cause: prettyCause,
    });
  }

  return Result.match(Cause.findError(cause), {
    onFailure: () => {
      return E.logFatal("[FATAL] Application failed with an unknown cause.", {
        cause: prettyCause,
      });
    },
    onSuccess: (error) => {
      return E.logError("[ERROR] Application failed with a known cause.", {
        cause: prettyCause,
        error,
      });
    },
  });
}
