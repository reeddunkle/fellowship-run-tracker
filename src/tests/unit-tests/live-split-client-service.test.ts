import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import {
  appendEOL,
  LiveSplitRequestCommand,
} from "@/services/live-split/core/live-split-command.ts";
import { makeLiveSplitTestHarness } from "@/tests/common/harnesses/live-split-test-harness.ts";
import { runTest } from "@/tests/common/run-test.ts";

describe("LiveSplitClient", () => {
  test("gets the current time", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const harness = yield* makeLiveSplitTestHarness();

        const request = yield* harness.start(harness.client.getCurrentTime());

        const command = yield* harness.takeCommand();

        expect(command).toBe(appendEOL(LiveSplitRequestCommand.getCurrentTime));

        yield* harness.sendResponse("00:01:23");

        expect(yield* request.join).toBe("00:01:23");
      }),
    );

    await runTest(program);
  });

  test("assembles a response split across multiple chunks", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const harness = yield* makeLiveSplitTestHarness();

        const request = yield* harness.start(harness.client.getCurrentTime());

        yield* harness.takeCommand();

        yield* harness.sendChunk("00:01");
        yield* harness.sendChunk(":23\r");
        yield* harness.sendChunk("\n");

        expect(yield* request.join).toBe("00:01:23");
      }),
    );

    await runTest(program);
  });

  test("handles multiple responses in one chunk", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const harness = yield* makeLiveSplitTestHarness();

        const currentTimeRequest = yield* harness.start(
          harness.client.getCurrentTime(),
        );

        yield* harness.takeCommand();

        const splitIndexRequest = yield* harness.start(
          harness.client.getSplitIndex(),
        );

        yield* harness.sendChunk(`${appendEOL("00:01:23")}${appendEOL("4")}`);

        const [currentTime, splitIndex] = yield* E.all(
          [currentTimeRequest.join, splitIndexRequest.join],
          { concurrency: "unbounded" },
        );

        expect(currentTime).toBe("00:01:23");
        expect(splitIndex).toBe(4);
      }),
    );

    await runTest(program);
  });

  test("serializes concurrent response-producing requests", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const harness = yield* makeLiveSplitTestHarness();

        const currentTimeRequest = yield* harness.start(
          harness.client.getCurrentTime(),
        );

        const splitIndexRequest = yield* harness.start(
          harness.client.getSplitIndex(),
        );

        const firstCommand = yield* harness.takeCommand();

        expect(firstCommand).toBe(
          appendEOL(LiveSplitRequestCommand.getCurrentTime),
        );

        yield* harness.sendResponse("00:01:23");

        const secondCommand = yield* harness.takeCommand();

        expect(secondCommand).toBe(
          appendEOL(LiveSplitRequestCommand.getSplitIndex),
        );

        yield* harness.sendResponse("4");

        const [currentTime, splitIndex] = yield* E.all(
          [currentTimeRequest.join, splitIndexRequest.join],
          { concurrency: "unbounded" },
        );

        expect(currentTime).toBe("00:01:23");
        expect(splitIndex).toBe(4);
      }),
    );

    await runTest(program);
  });
});
