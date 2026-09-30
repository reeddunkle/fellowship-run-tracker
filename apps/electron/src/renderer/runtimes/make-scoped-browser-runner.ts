import type * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import type * as ManagedRuntime from "effect/ManagedRuntime";

import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";

type BrowserServices = ManagedRuntime.ManagedRuntime.Services<
  typeof browserRuntime
>;

export type ScopedBrowserRunner = {
  readonly close: () => void;
  readonly run: (effect: E.Effect<void, never, BrowserServices>) => void;
};

export function makeScopedBrowserRunner(): ScopedBrowserRunner {
  const runningFibers = new Set<Fiber.Fiber<void>>();
  let isClosed = false;

  const run: ScopedBrowserRunner["run"] = (effect) => {
    if (isClosed) {
      return;
    }

    const fiber = browserRuntime.runFork(effect);

    runningFibers.add(fiber);

    fiber.addObserver(() => {
      runningFibers.delete(fiber);
    });
  };

  const close: ScopedBrowserRunner["close"] = () => {
    isClosed = true;

    const fibersToInterrupt = [...runningFibers];

    runningFibers.clear();

    browserRuntime.runFork(Fiber.interruptAll(fibersToInterrupt));
  };

  return {
    close,
    run,
  };
}
