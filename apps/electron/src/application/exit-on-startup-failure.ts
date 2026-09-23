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

    return `Another program is already using ${address}, which the app needs for its local API server.\n\nClose it (for example, a running development API server) and try again.`;
  }

  return Cause.pretty(cause);
}

export type ExitOnStartupFailureOptions = {
  readonly flushLogs: () => Promise<void>;
};

export function exitOnStartupFailure<A, Error>(
  exit: Exit.Exit<A, Error>,
  { flushLogs }: ExitOnStartupFailureOptions,
): Promise<void> {
  if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) {
    return Promise.resolve();
  }

  const { cause } = exit;

  return flushLogs().then(() => {
    dialog.showErrorBox(
      DIALOG_TITLE,
      `${getFailureMessage(cause)}\n\nLogs: ${appPaths.logs}`,
    );

    app.exit(1);
  });
}
