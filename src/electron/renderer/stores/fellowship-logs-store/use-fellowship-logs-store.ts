import * as E from "effect/Effect";
import { startTransition, useActionState, useSyncExternalStore } from "react";

import * as fellowshipLogsClient from "@/electron/renderer/api/fellowship-logs/fellowship-logs-client.ts";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";

import { fellowshipLogsStore } from "./fellowship-logs-store.ts";

type RateLimitDataActionResult = {
  readonly error: unknown | undefined;
};

export type FellowshipLogsStoreState = {
  readonly hasLoadedRateLimitData: boolean;
  readonly isLoadingLastKnownRateLimitData: boolean;
  readonly isRefreshingRateLimitData: boolean;
  readonly loadLastKnownRateLimitData: () => void;
  readonly rateLimitData: ReturnType<
    typeof fellowshipLogsStore.getSnapshot
  >["rateLimitData"];
  readonly refreshRateLimitData: () => void;
  readonly refreshRateLimitDataError: unknown | undefined;
};

const INITIAL_RATE_LIMIT_DATA_ACTION_RESULT: RateLimitDataActionResult = {
  error: undefined,
};

export function useFellowshipLogsStore(): FellowshipLogsStoreState {
  const snapshot = useSyncExternalStore(
    fellowshipLogsStore.subscribe,
    fellowshipLogsStore.getSnapshot,
  );

  const [
    loadLastKnownRateLimitDataState,
    dispatchLoadLastKnownRateLimitData,
    isLoadingLastKnownRateLimitData,
  ] = useActionState((): Promise<RateLimitDataActionResult> => {
    const effect = fellowshipLogsClient.getLastKnownRateLimitData().pipe(
      E.tap((rateLimitData) => {
        return E.sync(() => {
          fellowshipLogsStore.setRateLimitData(rateLimitData);
        });
      }),
      E.as({
        error: undefined,
      }),
      E.catch((error) => {
        return E.succeed({
          error,
        });
      }),
    );

    return browserRuntime.runPromise(effect);
  }, INITIAL_RATE_LIMIT_DATA_ACTION_RESULT);

  const [
    refreshRateLimitDataState,
    dispatchRefreshRateLimitData,
    isRefreshingRateLimitData,
  ] = useActionState((): Promise<RateLimitDataActionResult> => {
    const effect = fellowshipLogsClient.getRateLimitData().pipe(
      E.tap((rateLimitData) => {
        return E.sync(() => {
          fellowshipLogsStore.setRateLimitData(rateLimitData);
        });
      }),
      E.as({
        error: undefined,
      }),
      E.catch((error) => {
        return E.succeed({
          error,
        });
      }),
    );

    return browserRuntime.runPromise(effect);
  }, INITIAL_RATE_LIMIT_DATA_ACTION_RESULT);

  const loadLastKnownRateLimitData = () => {
    startTransition(() => {
      dispatchLoadLastKnownRateLimitData();
    });
  };

  const refreshRateLimitData = () => {
    startTransition(() => {
      dispatchRefreshRateLimitData();
    });
  };

  return {
    hasLoadedRateLimitData: snapshot.hasLoadedRateLimitData,
    isLoadingLastKnownRateLimitData,
    isRefreshingRateLimitData,
    loadLastKnownRateLimitData,
    rateLimitData: snapshot.rateLimitData,
    refreshRateLimitData,
    refreshRateLimitDataError:
      loadLastKnownRateLimitDataState.error ?? refreshRateLimitDataState.error,
  };
}
