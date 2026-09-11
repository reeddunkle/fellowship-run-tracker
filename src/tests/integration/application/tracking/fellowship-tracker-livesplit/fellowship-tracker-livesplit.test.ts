import { NodePath } from "@effect/platform-node";
import * as E from "effect/Effect";
import * as Path from "effect/Path";
import { describe, expect, test } from "vitest";

import { FellowshipTracker } from "@/application/fellowship-tracker/fellowship-tracker-service.ts";
import {
  appendEOL,
  LiveSplitSendCommand,
} from "@/services/live-split/core/live-split-command.ts";
import { makeFellowshipTrackerIntegrationTestHarness } from "@/tests/common/harnesses/fellowship-tracker-integration-test-harness.ts";
import {
  dungeonEndCommands,
  dungeonStartCommands,
} from "@/tests/common/live-split-test-commands.ts";
import { runTest } from "@/tests/common/run-test.ts";

import { configuration } from "./configuration.ts";

describe("FellowshipTracker LiveSplit", () => {
  test("sends LiveSplit commands for the configured run", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const path = yield* Path.Path;
        const { layer, liveSplitHarness } =
          yield* makeFellowshipTrackerIntegrationTestHarness();

        const logFilePath = path.join(import.meta.dirname, "log.txt");

        yield* E.gen(function* () {
          const fellowshipTracker = yield* FellowshipTracker;

          yield* fellowshipTracker.replayLog({
            configuration,
            logFilePath,
          });
        }).pipe(E.provide(layer));

        const commands = yield* liveSplitHarness.getCommands();

        const splitCommand = appendEOL(LiveSplitSendCommand.split);

        const configuredMilestoneCommands = configuration.milestones.map(() => {
          return splitCommand;
        });

        const expectedCommands = [
          ...dungeonStartCommands,
          ...configuredMilestoneCommands,
          ...dungeonEndCommands,
        ];

        expect(commands).toEqual(expectedCommands);

        expect(
          commands.filter((command) => {
            return command === splitCommand;
          }),
        ).toHaveLength(configuration.milestones.length);
      }),
    ).pipe(E.provide(NodePath.layer));

    await runTest(program);
  });
});
