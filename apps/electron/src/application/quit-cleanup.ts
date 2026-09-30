import * as Duration from "effect/Duration";

import { API_SERVER_GRACEFUL_SHUTDOWN_TIMEOUT } from "@frt/api/api/node-api-http-server.ts";

import { settleWithin } from "@/application/settle-within.ts";

const WINDOW_STATE_FLUSH_TIMEOUT_MILLISECONDS = 2_000;

const RUNTIME_RELEASE_HEADROOM = Duration.seconds(5);

const RUNTIME_DISPOSE_TIMEOUT_MILLISECONDS = Duration.toMillis(
  Duration.sum(API_SERVER_GRACEFUL_SHUTDOWN_TIMEOUT, RUNTIME_RELEASE_HEADROOM),
);

type RunQuitCleanupOptions = {
  readonly disposeRuntime: () => Promise<unknown>;
  readonly disposeTimeoutMilliseconds?: number;
  readonly flushWindowState: () => Promise<unknown>;
  readonly flushTimeoutMilliseconds?: number;
};

export function runQuitCleanup({
  disposeRuntime,
  disposeTimeoutMilliseconds = RUNTIME_DISPOSE_TIMEOUT_MILLISECONDS,
  flushWindowState,
  flushTimeoutMilliseconds = WINDOW_STATE_FLUSH_TIMEOUT_MILLISECONDS,
}: RunQuitCleanupOptions): Promise<void> {
  return settleWithin(flushWindowState, flushTimeoutMilliseconds).then(() => {
    return settleWithin(disposeRuntime, disposeTimeoutMilliseconds);
  });
}
