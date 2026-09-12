import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { DEFAULT_APP_STATE } from "@/electron/storage/app-state/app-state-schema.ts";
import { makeAppStateUpdateWorkerTestHarness } from "@/tests/common/harnesses/app-state-update-worker-test-harness.ts";
import { runTest } from "@/tests/common/run-test.ts";

describe("AppStateUpdateWorker", () => {
  test("processes a submitted app state", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const harness = yield* makeAppStateUpdateWorkerTestHarness();

        const appState = {
          ...DEFAULT_APP_STATE,
          sidebarOpen: !DEFAULT_APP_STATE.sidebarOpen,
        };

        const { process, submission } =
          yield* harness.startAndTakeProcess(appState);

        expect(process.state).toEqual(appState);

        yield* process.succeed;
        yield* submission.join;

        const processedStates = yield* harness.getProcessedStates();

        expect(processedStates).toEqual([appState]);
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
        const firstProcess = yield* harness.takeProcess();

        expect(firstProcess.state).toEqual(firstState);

        const secondSubmission = yield* harness.start(secondState);
        const latestSubmission = yield* harness.start(latestState);

        yield* firstProcess.succeed;

        const latestProcess = yield* harness.takeProcess();

        expect(latestProcess.state).toEqual(latestState);

        yield* latestProcess.succeed;

        yield* firstSubmission.join;
        yield* secondSubmission.join;
        yield* latestSubmission.join;

        const processedStates = yield* harness.getProcessedStates();

        expect(processedStates).toEqual([firstState, latestState]);
      }),
    );

    await runTest(program);
  });

  test("fails coalesced submissions when processing the latest state fails", async () => {
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
        const firstProcess = yield* harness.takeProcess();

        const secondSubmission = yield* harness.start(secondState);
        const latestSubmission = yield* harness.start(latestState);

        yield* firstProcess.succeed;

        const latestProcess = yield* harness.takeProcess();

        expect(latestProcess.state).toEqual(latestState);

        yield* latestProcess.fail("latest update failed");

        yield* firstSubmission.join;

        const secondResult = yield* secondSubmission.result;
        const latestResult = yield* latestSubmission.result;

        expect(secondResult._tag).toBe("Failure");
        expect(latestResult._tag).toBe("Failure");

        const processedStates = yield* harness.getProcessedStates();

        expect(processedStates).toEqual([firstState, latestState]);
      }),
    );

    await runTest(program);
  });

  test("processes subsequent app states after completing a batch", async () => {
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
        };

        const first = yield* harness.startAndTakeProcess(firstState);

        expect(first.process.state).toEqual(firstState);

        yield* first.process.succeed;
        yield* first.submission.join;

        const second = yield* harness.startAndTakeProcess(secondState);

        expect(second.process.state).toEqual(secondState);

        yield* second.process.succeed;
        yield* second.submission.join;

        expect(yield* harness.getProcessedStates()).toEqual([
          firstState,
          secondState,
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

        const failed = yield* harness.startAndTakeProcess(failedState);

        yield* failed.process.fail("update failed");

        const failedResult = yield* failed.submission.result;

        expect(failedResult._tag).toBe("Failure");

        const next = yield* harness.startAndTakeProcess(nextState);

        expect(next.process.state).toEqual(nextState);

        yield* next.process.succeed;
        yield* next.submission.join;

        expect(yield* harness.getProcessedStates()).toEqual([
          failedState,
          nextState,
        ]);
      }),
    );

    await runTest(program);
  });
});
