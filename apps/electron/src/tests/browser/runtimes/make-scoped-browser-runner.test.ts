import * as E from "effect/Effect";
import { describe, expect, test, vi } from "vitest";

import { makeScopedBrowserRunner } from "@/renderer/runtimes/make-scoped-browser-runner.ts";

describe("makeScopedBrowserRunner", () => {
  test("interrupts every running program when closed", async () => {
    let interruptedProgramCount = 0;

    const runner = makeScopedBrowserRunner();

    const neverEndingProgram = E.never.pipe(
      E.onInterrupt(() => {
        return E.sync(() => {
          interruptedProgramCount += 1;
        });
      }),
    );

    runner.run(neverEndingProgram);
    runner.run(neverEndingProgram);

    runner.close();

    await vi.waitFor(() => {
      expect(interruptedProgramCount).toBe(2);
    });
  });

  test("does not start programs after being closed", async () => {
    let startedProgramCount = 0;
    let hasOpenRunnerProgramRun = false;

    const closedRunner = makeScopedBrowserRunner();
    const openRunner = makeScopedBrowserRunner();

    closedRunner.close();

    closedRunner.run(
      E.sync(() => {
        startedProgramCount += 1;
      }),
    );

    openRunner.run(
      E.sync(() => {
        hasOpenRunnerProgramRun = true;
      }),
    );

    await vi.waitFor(() => {
      expect(hasOpenRunnerProgramRun).toBe(true);
    });

    openRunner.close();

    expect(startedProgramCount).toBe(0);
  });
});
