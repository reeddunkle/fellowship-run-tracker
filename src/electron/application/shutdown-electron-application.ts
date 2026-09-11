import * as E from "effect/Effect";
import type * as ManagedRuntime from "effect/ManagedRuntime";

import { ElectronApplicationShutdownError } from "@/errors/electron-error.ts";

type ShutdownElectronApplicationOptions<R, E> = {
  readonly runtime: ManagedRuntime.ManagedRuntime<R, E>;
};

export function shutdownElectronApplication<R, E>({
  runtime,
}: ShutdownElectronApplicationOptions<R, E>) {
  return E.tryPromise({
    catch: (cause) => {
      return new ElectronApplicationShutdownError({
        cause,
      });
    },
    try: () => {
      return runtime.dispose();
    },
  });
}
