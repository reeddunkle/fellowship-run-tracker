import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { DEFAULT_APP_STATE } from "@/electron/storage/app-state/app-state-schema.ts";
import { makeAppStateTestHarness } from "@/tests/common/harnesses/app-state-test-harness.ts";
import { runTest } from "@/tests/common/run-test.ts";

describe("AppStateService", () => {
  test("gets the initial app state", async () => {
    const initialState = {
      ...DEFAULT_APP_STATE,
      sidebarOpen: !DEFAULT_APP_STATE.sidebarOpen,
    };

    const program = E.scoped(
      E.gen(function* () {
        const harness = yield* makeAppStateTestHarness({
          initialState,
        });

        expect(yield* harness.appState.get).toEqual(initialState);
      }),
    );

    await runTest(program);
  });

  test("updates the app state after a successful update", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const harness = yield* makeAppStateTestHarness();

        const appState = {
          ...DEFAULT_APP_STATE,
          sidebarOpen: !DEFAULT_APP_STATE.sidebarOpen,
        };

        const { submission, update } =
          yield* harness.startAndTakeUpdate(appState);

        expect(yield* harness.appState.get).toEqual(DEFAULT_APP_STATE);

        yield* update.succeed;
        yield* submission.join;

        expect(yield* harness.appState.get).toEqual(appState);
      }),
    );

    await runTest(program);
  });

  test("keeps the previous app state when an update fails", async () => {
    const initialState = {
      ...DEFAULT_APP_STATE,
      theme: "light" as const,
    };

    const failedState = {
      ...initialState,
      theme: "dark" as const,
    };

    const program = E.scoped(
      E.gen(function* () {
        const harness = yield* makeAppStateTestHarness<"update failed">({
          initialState,
        });

        const { submission, update } =
          yield* harness.startAndTakeUpdate(failedState);

        yield* update.fail("update failed");

        expect((yield* submission.result)._tag).toBe("Failure");
        expect(yield* harness.appState.get).toEqual(initialState);
      }),
    );

    await runTest(program);
  });
});
