export function settleWithin(
  run: () => Promise<unknown>,
  timeoutMilliseconds: number,
): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;

  const settled = Promise.resolve()
    .then(run)
    .then(
      () => {
        return undefined;
      },
      () => {
        return undefined;
      },
    );

  // @effect-diagnostics-next-line newPromise:off
  const timedOut = new Promise<void>((resolve) => {
    // @effect-diagnostics-next-line globalTimers:off
    timeout = setTimeout(resolve, timeoutMilliseconds);
  });

  return Promise.race([settled, timedOut]).finally(() => {
    clearTimeout(timeout);
  });
}
