import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import type * as ManagedRuntime from "effect/ManagedRuntime";

import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";

type BrowserServices = ManagedRuntime.ManagedRuntime.Services<
  typeof browserRuntime
>;

export type RestartableBrowserProgram = {
  readonly start: () => void;
  readonly stop: () => void;
};

type ProgramRun = {
  fiber: Fiber.Fiber<void, unknown> | undefined;
};

export function makeRestartableBrowserProgram(
  makeProgram: () => E.Effect<void, never, BrowserServices>,
): RestartableBrowserProgram {
  let activeRun: ProgramRun | undefined;

  function start(): void {
    if (activeRun !== undefined) {
      return;
    }

    const run: ProgramRun = {
      fiber: undefined,
    };

    activeRun = run;

    run.fiber = browserRuntime.runFork(
      makeProgram().pipe(
        E.ensuring(
          E.sync(() => {
            if (activeRun === run) {
              activeRun = undefined;
            }
          }),
        ),
      ),
    );
  }

  function stop(): void {
    const run = activeRun;

    if (run === undefined) {
      return;
    }

    activeRun = undefined;

    run.fiber?.pipe(Fiber.interrupt, E.runFork);
  }

  return {
    start,
    stop,
  };
}
