import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { DEFAULT_APP_STATE } from "@/electron/storage/app-state/app-state-schema.ts";
import { makeAppStateUpdateWorkerTestHarness } from "@/tests/common/harnesses/app-state-update-worker-test-harness.ts";
import { runTest } from "@/tests/common/run-test.ts";

describe("AppStateUpdateWorker", () => {
  test("processes an app state update", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const harness = yield* makeAppStateUpdateWorkerTestHarness();

        const appState = {
          ...DEFAULT_APP_STATE,
          sidebarOpen: !DEFAULT_APP_STATE.sidebarOpen,
        };

        const submission = yield* harness.start(appState);
        const update = yield* harness.takeUpdate();

        expect(update.state).toEqual(appState);

        yield* update.succeed;
        yield* submission.join;

        expect(yield* harness.getUpdatedStates()).toEqual([appState]);
      }),
    );

    await runTest(program);
  });

  test("coalesces pending updates to the latest app state", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const harness = yield* makeAppStateUpdateWorkerTestHarness();

        const firstState = {
          ...DEFAULT_APP_STATE,
          sidebarOpen: false,
        };

        const secondState = {
          ...DEFAULT_APP_STATE,
          sidebarOpen: true,
          theme: "light" as const,
        };

        const latestState = {
          ...DEFAULT_APP_STATE,
          sidebarOpen: true,
          theme: "dark" as const,
        };

        const firstSubmission = yield* harness.start(firstState);
        const firstUpdate = yield* harness.takeUpdate();

        expect(firstUpdate.state).toEqual(firstState);

        const secondSubmission = yield* harness.start(secondState);
        const latestSubmission = yield* harness.start(latestState);

        yield* firstUpdate.succeed;

        const latestUpdate = yield* harness.takeUpdate();

        expect(latestUpdate.state).toEqual(latestState);

        yield* latestUpdate.succeed;

        yield* firstSubmission.join;
        yield* secondSubmission.join;
        yield* latestSubmission.join;

        expect(yield* harness.getUpdatedStates()).toEqual([
          firstState,
          latestState,
        ]);
      }),
    );

    await runTest(program);
  });

  test("fails coalesced submissions when the latest update fails", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const harness =
          yield* makeAppStateUpdateWorkerTestHarness<"latest update failed">();

        const firstState = {
          ...DEFAULT_APP_STATE,
          sidebarOpen: false,
        };

        const secondState = {
          ...DEFAULT_APP_STATE,
          sidebarOpen: true,
          theme: "light" as const,
        };

        const latestState = {
          ...DEFAULT_APP_STATE,
          sidebarOpen: true,
          theme: "dark" as const,
        };

        const firstSubmission = yield* harness.start(firstState);
        const firstUpdate = yield* harness.takeUpdate();

        expect(firstUpdate.state).toEqual(firstState);

        const secondSubmission = yield* harness.start(secondState);
        const latestSubmission = yield* harness.start(latestState);

        yield* firstUpdate.succeed;
        yield* firstSubmission.join;

        const latestUpdate = yield* harness.takeUpdate();

        expect(latestUpdate.state).toEqual(latestState);

        yield* latestUpdate.fail("latest update failed");

        const secondResult = yield* secondSubmission.result;
        const latestResult = yield* latestSubmission.result;

        expect(secondResult._tag).toBe("Failure");
        expect(latestResult._tag).toBe("Failure");

        expect(yield* harness.getUpdatedStates()).toEqual([
          firstState,
          latestState,
        ]);
      }),
    );

    await runTest(program);
  });

  test("continues processing after a failed batch", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const harness =
          yield* makeAppStateUpdateWorkerTestHarness<"update failed">();

        const failedState = {
          ...DEFAULT_APP_STATE,
          sidebarOpen: false,
        };

        const nextState = {
          ...DEFAULT_APP_STATE,
          sidebarOpen: true,
        };

        const failedSubmission = yield* harness.start(failedState);
        const failedUpdate = yield* harness.takeUpdate();

        expect(failedUpdate.state).toEqual(failedState);

        yield* failedUpdate.fail("update failed");

        expect((yield* failedSubmission.result)._tag).toBe("Failure");

        const nextSubmission = yield* harness.start(nextState);
        const nextUpdate = yield* harness.takeUpdate();

        expect(nextUpdate.state).toEqual(nextState);

        yield* nextUpdate.succeed;
        yield* nextSubmission.join;

        expect(yield* harness.getUpdatedStates()).toEqual([
          failedState,
          nextState,
        ]);
      }),
    );

    await runTest(program);
  });
});
