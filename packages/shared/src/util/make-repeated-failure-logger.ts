import * as Cause from "effect/Cause";
import * as E from "effect/Effect";
import * as Ref from "effect/Ref";

type ThresholdLevel = "Error" | "Warn";

type RepeatedFailureLoggerOptions = {
  readonly level: ThresholdLevel;
  readonly message: string;
  readonly threshold?: number;
};

export type RepeatedFailureLogger = {
  readonly onFailure: (
    cause: Cause.Cause<unknown>,
    annotations?: Readonly<Record<string, unknown>>,
  ) => E.Effect<number>;
  readonly onSuccess: E.Effect<void>;
};

const LOG_AT_THRESHOLD = {
  Error: E.logError,
  Warn: E.logWarning,
} satisfies Record<ThresholdLevel, typeof E.logError>;

export function makeRepeatedFailureLogger({
  level,
  message,
  threshold = 1,
}: RepeatedFailureLoggerOptions): E.Effect<RepeatedFailureLogger> {
  return E.map(Ref.make(0), (failureCountRef): RepeatedFailureLogger => {
    const onFailure: RepeatedFailureLogger["onFailure"] = (
      cause,
      annotations = {},
    ) => {
      return Ref.updateAndGet(failureCountRef, (count) => {
        return count + 1;
      }).pipe(
        E.flatMap((consecutiveFailures) => {
          const payload = {
            ...annotations,
            cause: Cause.pretty(cause),
            consecutiveFailures,
          };

          const log =
            consecutiveFailures === threshold
              ? LOG_AT_THRESHOLD[level](message, payload)
              : E.logDebug(message, payload);

          return log.pipe(E.as(consecutiveFailures));
        }),
      );
    };

    const onSuccess = Ref.getAndSet(failureCountRef, 0).pipe(
      E.flatMap((failureCount) => {
        return failureCount < threshold
          ? E.void
          : E.logInfo("Recovered after repeated failures.", {
              failedMessage: message,
              failureCount,
            });
      }),
    );

    return { onFailure, onSuccess };
  });
}
