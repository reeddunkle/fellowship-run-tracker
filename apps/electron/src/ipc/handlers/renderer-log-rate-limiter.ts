type RateLimitWindow = {
  count: number;
  suppressedCount: number;
  startedAtMilliseconds: number;
};

type RendererLogRateLimiterOptions = {
  readonly maxEntriesPerWindow: number;
  readonly maxTrackedKeys: number;
  readonly windowMilliseconds: number;
};

export type RendererLogRateLimitDecision =
  | { readonly isAllowed: false }
  | { readonly isAllowed: true; readonly suppressedCount: number };

export function makeRendererLogRateLimiter({
  maxEntriesPerWindow,
  maxTrackedKeys,
  windowMilliseconds,
}: RendererLogRateLimiterOptions) {
  const windows = new Map<string, RateLimitWindow>();

  return (
    key: string,
    nowMilliseconds: number,
  ): RendererLogRateLimitDecision => {
    const current = windows.get(key);

    if (
      current === undefined ||
      nowMilliseconds - current.startedAtMilliseconds >= windowMilliseconds
    ) {
      if (current === undefined && windows.size >= maxTrackedKeys) {
        windows.clear();
      }

      windows.set(key, {
        count: 1,
        startedAtMilliseconds: nowMilliseconds,
        suppressedCount: 0,
      });

      return {
        isAllowed: true,
        suppressedCount: current?.suppressedCount ?? 0,
      };
    }

    if (current.count < maxEntriesPerWindow) {
      current.count += 1;

      return { isAllowed: true, suppressedCount: 0 };
    }

    current.suppressedCount += 1;

    return { isAllowed: false };
  };
}
