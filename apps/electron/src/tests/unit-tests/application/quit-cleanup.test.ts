import { describe, expect, test, vi } from "vitest";

import { makeQuitCleanup, runQuitCleanup } from "@/application/quit-cleanup.ts";

const SHORT_TIMEOUT_MILLISECONDS = 10;

function never(): Promise<never> {
  // @effect-diagnostics-next-line newPromise:off
  return new Promise<never>(() => {});
}

describe("runQuitCleanup", () => {
  test("flushes window state and then disposes the runtime", async () => {
    const calls: Array<string> = [];

    await runQuitCleanup({
      disposeRuntime: () => {
        calls.push("dispose");

        return Promise.resolve();
      },
      flushWindowState: () => {
        calls.push("flush");

        return Promise.resolve();
      },
    });

    expect(calls).toEqual(["flush", "dispose"]);
  });

  test("disposes the runtime when flushing window state rejects", async () => {
    const disposeRuntime = vi.fn(() => {
      return Promise.resolve();
    });

    await runQuitCleanup({
      disposeRuntime,
      flushWindowState: () => {
        return Promise.reject(new Error("Test flush failure."));
      },
    });

    expect(disposeRuntime).toHaveBeenCalledOnce();
  });

  test("disposes the runtime when flushing window state throws synchronously", async () => {
    const disposeRuntime = vi.fn(() => {
      return Promise.resolve();
    });

    await runQuitCleanup({
      disposeRuntime,
      flushWindowState: () => {
        throw new Error("Test synchronous flush failure.");
      },
    });

    expect(disposeRuntime).toHaveBeenCalledOnce();
  });

  test("disposes the runtime when flushing window state never finishes", async () => {
    const disposeRuntime = vi.fn(() => {
      return Promise.resolve();
    });

    await runQuitCleanup({
      disposeRuntime,
      flushTimeoutMilliseconds: SHORT_TIMEOUT_MILLISECONDS,
      flushWindowState: never,
    });

    expect(disposeRuntime).toHaveBeenCalledOnce();
  });

  test("finishes when disposing the runtime never finishes", async () => {
    await expect(
      runQuitCleanup({
        disposeRuntime: never,
        disposeTimeoutMilliseconds: SHORT_TIMEOUT_MILLISECONDS,
        flushWindowState: () => {
          return Promise.resolve();
        },
      }),
    ).resolves.toBeUndefined();
  });
});

describe("makeQuitCleanup", () => {
  test("runs the cleanup once no matter how many quit paths trigger it", async () => {
    const disposeRuntime = vi.fn(() => {
      return Promise.resolve();
    });

    const flushWindowState = vi.fn(() => {
      return Promise.resolve();
    });

    const runQuitCleanupOnce = makeQuitCleanup({
      disposeRuntime,
      flushWindowState,
    });

    const firstCleanup = runQuitCleanupOnce();
    const secondCleanup = runQuitCleanupOnce();

    expect(secondCleanup).toBe(firstCleanup);

    await Promise.all([firstCleanup, secondCleanup, runQuitCleanupOnce()]);

    expect(flushWindowState).toHaveBeenCalledOnce();
    expect(disposeRuntime).toHaveBeenCalledOnce();
  });
});
