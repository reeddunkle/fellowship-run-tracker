import * as E from "effect/Effect";
import type * as ManagedRuntime from "effect/ManagedRuntime";

import { ElectronApplicationShutdownError } from "@/errors/electron-error.ts";

type ShutdownElectronApplicationOptions<R, Error> = {
  readonly runtime: ManagedRuntime.ManagedRuntime<R, Error>;
};

export function shutdownElectronApplication<R, Error>({
  runtime,
}: ShutdownElectronApplicationOptions<R, Error>) {
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
