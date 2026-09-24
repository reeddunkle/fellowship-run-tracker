import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as HashMap from "effect/HashMap";
import { describe, expect, test } from "vitest";

import { publishDungeonRunState } from "@frt/api/api/websocket/dungeon-run/publish-dungeon-run-state.ts";
import { DungeonRunWebSocketBroadcaster } from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import {
  type ConfiguredDungeonRunProcessingState,
  type ConfiguredDungeonRunState,
} from "@frt/api/services/fellowship/dungeon-runs/configured-dungeon-run-processing-state.ts";
import { type DungeonRunProcessingState } from "@frt/api/services/fellowship/dungeon-runs/dungeon-run-processing-state.ts";
import {
  type DungeonRunTrackerState,
  initialDungeonRunTrackerState,
} from "@frt/api/services/fellowship/dungeon-runs/track-dungeon-run.ts";
import {
  initialRequirementProcessorState,
  type RequirementObservationsByTargetId,
  type RequirementProcessorState,
} from "@frt/api/services/fellowship/requirements/requirement-processor-state.ts";
import { makeWebSocketBroadcasterTestHarness } from "@frt/api/tests/common/harnesses/websocket-broadcaster-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { type RequirementEventType } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";

function createConfiguredDungeonRunProcessingState({
  dungeonRun,
  requirementProcessor = initialRequirementProcessorState,
}: {
  readonly dungeonRun?: ConfiguredDungeonRunState;
  readonly requirementProcessor?: RequirementProcessorState;
} = {}): ConfiguredDungeonRunProcessingState {
  return {
    dungeonRun,
    requirementProcessor,
  };
}

function createDungeonRunProcessingState({
  configuredRun = createConfiguredDungeonRunProcessingState(),
  runTracker = initialDungeonRunTrackerState,
}: {
  readonly configuredRun?: ConfiguredDungeonRunProcessingState;
  readonly runTracker?: DungeonRunTrackerState;
} = {}): DungeonRunProcessingState {
  return {
    configuredRun,
    runTracker,
  };
}

describe("publishDungeonRunState", () => {
  test("publishes an active run state", async () => {
    const program = E.gen(function* () {
      const webSocketBroadcasterHarness =
        yield* makeWebSocketBroadcasterTestHarness();

      const state = createDungeonRunProcessingState({
        configuredRun: createConfiguredDungeonRunProcessingState({
          dungeonRun: {
            startedAt: DateTime.makeUnsafe(1_000),
            status: "ACTIVE",
          },
        }),
      });

      yield* publishDungeonRunState({
        state,
      }).pipe(
        E.provideService(
          DungeonRunWebSocketBroadcaster,
          webSocketBroadcasterHarness.webSocketBroadcaster,
        ),
      );

      const messages = yield* webSocketBroadcasterHarness.getParsedMessages();

      expect(messages).toEqual([
        {
          state: {
            dungeonRun: {
              endedAtMilliseconds: null,
              startedAtMilliseconds: 1_000,
              status: "ACTIVE",
            },
            observations: [],
          },
          version: 1,
        },
      ]);
    });

    await runTest(program);
  });

  test("publishes requirement observations", async () => {
    const program = E.gen(function* () {
      const webSocketBroadcasterHarness =
        yield* makeWebSocketBroadcasterTestHarness();

      const requirementTimestamp = DateTime.makeUnsafe(13_345);

      const observationsByTargetId: RequirementObservationsByTargetId =
        HashMap.make([
          "42",
          {
            observations: [
              {
                timestamp: requirementTimestamp,
              },
            ],
          },
        ]);

      const requirementObservations = HashMap.set(
        HashMap.empty<
          RequirementEventType,
          RequirementObservationsByTargetId
        >(),
        "UNIT_DEATH",
        observationsByTargetId,
      );

      const state = createDungeonRunProcessingState({
        configuredRun: createConfiguredDungeonRunProcessingState({
          dungeonRun: {
            startedAt: DateTime.makeUnsafe(1_000),
            status: "ACTIVE",
          },
          requirementProcessor: {
            requirementObservations,
          },
        }),
      });

      yield* publishDungeonRunState({
        state,
      }).pipe(
        E.provideService(
          DungeonRunWebSocketBroadcaster,
          webSocketBroadcasterHarness.webSocketBroadcaster,
        ),
      );

      const messages = yield* webSocketBroadcasterHarness.getParsedMessages();

      expect(messages).toEqual([
        {
          state: {
            dungeonRun: {
              endedAtMilliseconds: null,
              startedAtMilliseconds: 1_000,
              status: "ACTIVE",
            },
            observations: [
              {
                targetId: "42",
                timestampMilliseconds: 13_345,
                type: "UNIT_DEATH",
              },
            ],
          },
          version: 1,
        },
      ]);
    });

    await runTest(program);
  });

  test("publishes a completed run state", async () => {
    const program = E.gen(function* () {
      const webSocketBroadcasterHarness =
        yield* makeWebSocketBroadcasterTestHarness();

      const state = createDungeonRunProcessingState({
        configuredRun: createConfiguredDungeonRunProcessingState({
          dungeonRun: {
            endedAt: DateTime.makeUnsafe(13_345),
            startedAt: DateTime.makeUnsafe(1_000),
            status: "COMPLETED",
          },
        }),
      });

      yield* publishDungeonRunState({
        state,
      }).pipe(
        E.provideService(
          DungeonRunWebSocketBroadcaster,
          webSocketBroadcasterHarness.webSocketBroadcaster,
        ),
      );

      const messages = yield* webSocketBroadcasterHarness.getParsedMessages();

      expect(messages).toEqual([
        {
          state: {
            dungeonRun: {
              endedAtMilliseconds: 13_345,
              startedAtMilliseconds: 1_000,
              status: "COMPLETED",
            },
            observations: [],
          },
          version: 1,
        },
      ]);
    });

    await runTest(program);
  });

  test("publishes an idle run state", async () => {
    const program = E.gen(function* () {
      const webSocketBroadcasterHarness =
        yield* makeWebSocketBroadcasterTestHarness();

      yield* publishDungeonRunState({
        state: createDungeonRunProcessingState(),
      }).pipe(
        E.provideService(
          DungeonRunWebSocketBroadcaster,
          webSocketBroadcasterHarness.webSocketBroadcaster,
        ),
      );

      const messages = yield* webSocketBroadcasterHarness.getParsedMessages();

      expect(messages).toEqual([
        {
          state: {
            dungeonRun: null,
            observations: [],
          },
          version: 1,
        },
      ]);
    });

    await runTest(program);
  });
});
