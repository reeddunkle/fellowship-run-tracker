type Flush = () => Promise<unknown>;

let registeredFlush: Flush | undefined;

export function registerFatalExitFlush(flush: Flush) {
  registeredFlush = flush;
}

export function flushBeforeFatalExit(timeoutMilliseconds: number) {
  if (registeredFlush === undefined) {
    return Promise.resolve();
  }

  return Promise.race([
    registeredFlush().catch(() => {
      return undefined;
    }),
    // @effect-diagnostics-next-line newPromise:off
    new Promise((resolve) => {
      // @effect-diagnostics-next-line globalTimers:off
      setTimeout(resolve, timeoutMilliseconds);
    }),
  ]);
}
