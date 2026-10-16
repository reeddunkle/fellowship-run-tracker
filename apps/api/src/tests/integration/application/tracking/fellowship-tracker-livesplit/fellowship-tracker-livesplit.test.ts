import { NodePath } from "@effect/platform-node";
import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { LiveSplit } from "@frt/api/services/live-split/live-split-service.ts";
import {
  appendEOL,
  LiveSplitGatewaySendCommand,
} from "@frt/api/services/live-split-gateway/live-split-gateway-command.ts";
import { EVERDAWN_GROVE_64_CONFIGURATION } from "@frt/api/tests/common/fixtures/everdawn-grove-configuration-fixtures.ts";
import { EVERDAWN_GROVE_64_TIMED_LOG_PATH } from "@frt/api/tests/common/fixtures/fellowship-log-fixtures.ts";
import { makeFellowshipTrackerIntegrationTestHarness } from "@frt/api/tests/common/harnesses/fellowship-tracker-integration-test-harness.ts";
import {
  dungeonEndCommands,
  dungeonStartCommands,
} from "@frt/api/tests/common/live-split-gateway-test-commands.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

describe("FellowshipTracker LiveSplit", () => {
  test("sends LiveSplit commands for the configured run", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const { layer, liveSplitHarness } =
          yield* makeFellowshipTrackerIntegrationTestHarness();

        yield* E.gen(function* () {
          const liveSplit = yield* LiveSplit;
          const fellowshipTracker = yield* FellowshipTracker;

          yield* liveSplit.connect();

          yield* fellowshipTracker.replayLog({
            configuration: EVERDAWN_GROVE_64_CONFIGURATION,
            logFilePath: EVERDAWN_GROVE_64_TIMED_LOG_PATH,
          });
        }).pipe(E.provide(layer));

        const commands = yield* liveSplitHarness.getCommands();

        const splitCommand = appendEOL(LiveSplitGatewaySendCommand.split);

        const configuredMilestoneCommands =
          EVERDAWN_GROVE_64_CONFIGURATION.milestones.map(() => {
            return splitCommand;
          });

        const expectedCommands = [
          ...dungeonStartCommands,
          ...configuredMilestoneCommands,
          ...dungeonEndCommands,
        ];

        expect(commands).toEqual(expectedCommands);
      }),
    ).pipe(E.provide(NodePath.layer));

    await runTest(program);
  });
});
