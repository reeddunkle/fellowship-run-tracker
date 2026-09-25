import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import {
  appendEOL,
  LiveSplitGatewayRequestCommand,
} from "@frt/api/services/live-split-gateway/live-split-gateway-command.ts";
import { makeLiveSplitGatewayClientTestHarness } from "@frt/api/tests/common/harnesses/live-split-gateway-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

describe("LiveSplitGatewayClient", () => {
  test("gets the current time", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const harness = yield* makeLiveSplitGatewayClientTestHarness();

        const request = yield* harness.start(harness.client.getCurrentTime());

        const command = yield* harness.takeCommand();

        expect(command).toBe(
          appendEOL(LiveSplitGatewayRequestCommand.getCurrentTime),
        );

        yield* harness.sendResponse("00:01:23");

        expect(yield* request.join).toBe("00:01:23");
      }),
    );

    await runTest(program);
  });

  test("assembles a response split across multiple chunks", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const harness = yield* makeLiveSplitGatewayClientTestHarness();

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
        const harness = yield* makeLiveSplitGatewayClientTestHarness();

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
        const harness = yield* makeLiveSplitGatewayClientTestHarness();

        const currentTimeRequest = yield* harness.start(
          harness.client.getCurrentTime(),
        );

        const splitIndexRequest = yield* harness.start(
          harness.client.getSplitIndex(),
        );

        const firstCommand = yield* harness.takeCommand();

        expect(firstCommand).toBe(
          appendEOL(LiveSplitGatewayRequestCommand.getCurrentTime),
        );

        yield* harness.sendResponse("00:01:23");

        const secondCommand = yield* harness.takeCommand();

        expect(secondCommand).toBe(
          appendEOL(LiveSplitGatewayRequestCommand.getSplitIndex),
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
