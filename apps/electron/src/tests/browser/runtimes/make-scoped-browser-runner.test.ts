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

  test("lets programs finish on their own before being closed", async () => {
    let completedProgramCount = 0;

    const runner = makeScopedBrowserRunner();

    runner.run(
      E.sync(() => {
        completedProgramCount += 1;
      }),
    );

    await vi.waitFor(() => {
      expect(completedProgramCount).toBe(1);
    });

    runner.close();
  });

  test("does not start programs after being closed", async () => {
    let startedProgramCount = 0;

    const runner = makeScopedBrowserRunner();

    runner.close();

    runner.run(
      E.sync(() => {
        startedProgramCount += 1;
      }),
    );

    await E.runPromise(E.sleep("10 millis"));

    expect(startedProgramCount).toBe(0);
  });
});
