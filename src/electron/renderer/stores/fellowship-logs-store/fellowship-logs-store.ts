import { type FellowshipLogsApiRateLimitData } from "@/services/api/fellowship-logs/fellowship-logs-api-schema.ts";

export type FellowshipLogsStoreSnapshot = {
  readonly hasLoadedRateLimitData: boolean;
  readonly rateLimitData: FellowshipLogsApiRateLimitData | null;
};

type FellowshipLogsStore = {
  readonly getSnapshot: () => FellowshipLogsStoreSnapshot;
  readonly setRateLimitData: (
    rateLimitData: FellowshipLogsApiRateLimitData | null,
  ) => void;
  readonly subscribe: (listener: () => void) => () => void;
};

const INITIAL_SNAPSHOT: FellowshipLogsStoreSnapshot = {
  hasLoadedRateLimitData: false,
  rateLimitData: null,
};

function makeFellowshipLogsStore(): FellowshipLogsStore {
  let snapshot = INITIAL_SNAPSHOT;

  const listeners = new Set<() => void>();

  const getSnapshot: FellowshipLogsStore["getSnapshot"] = () => {
    return snapshot;
  };

  const subscribe: FellowshipLogsStore["subscribe"] = (listener) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  const setRateLimitData: FellowshipLogsStore["setRateLimitData"] = (
    rateLimitData,
  ) => {
    snapshot = {
      ...snapshot,
      hasLoadedRateLimitData: true,
      rateLimitData,
    };

    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSnapshot,
    setRateLimitData,
    subscribe,
  };
}

export const fellowshipLogsStore = makeFellowshipLogsStore();
