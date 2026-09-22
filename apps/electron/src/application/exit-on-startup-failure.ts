import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import { app, dialog } from "electron";

import { appPaths } from "@frt/api/helpers/app-paths.ts";

const DIALOG_TITLE = "Fellowship Run Tracker failed to start";

type NodeSystemError = {
  readonly address?: unknown;
  readonly code: unknown;
  readonly port?: unknown;
};

/** Follows the `cause` chain looking for a Node system error with `code`. */
function findSystemError(
  value: unknown,
  code: string,
): NodeSystemError | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if ("code" in value && value.code === code) {
    return value;
  }

  return "cause" in value ? findSystemError(value.cause, code) : undefined;
}

function getFailureMessage<E>(cause: Cause.Cause<E>) {
  const addressInUseError = findSystemError(Cause.squash(cause), "EADDRINUSE");

  if (addressInUseError !== undefined) {
    const address = `${String(addressInUseError.address)}:${String(addressInUseError.port)}`;

    // The single instance lock stops a second copy of the app itself, so
    // this is most likely something else, e.g. the dev API server.
    return `Another program is already using ${address}, which the app needs for its local API server.\n\nClose it (for example, a running development API server) and try again.`;
  }

  return Cause.pretty(cause);
}

export type ExitOnStartupFailureOptions = {
  /** Writes out batched log entries; the process exits right after. */
  readonly flushLogs: () => Promise<void>;
};

/**
 * A failed startup leaves the app with no window, so surface the failure
 * instead of leaving a background process running with nothing on screen.
 * The cause is expected to have already been logged via `logCause`.
 */
export function exitOnStartupFailure<A, Error>(
  exit: Exit.Exit<A, Error>,
  { flushLogs }: ExitOnStartupFailureOptions,
): Promise<void> {
  if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) {
    return Promise.resolve();
  }

  const { cause } = exit;

  // Before the dialog: it blocks the main process until dismissed.
  return flushLogs().then(() => {
    dialog.showErrorBox(
      DIALOG_TITLE,
      `${getFailureMessage(cause)}\n\nLogs: ${appPaths.logs}`,
    );

    app.exit(1);
  });
}
