import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as HashMap from "effect/HashMap";
import { describe, expect, test } from "vitest";

import { publishDungeonRunState } from "@/api/websocket/dungeon-run/publish-dungeon-run-state.ts";
import { DungeonRunWebSocketBroadcaster } from "@/services/api/websocket-broadcaster-service.ts";
import {
  type DungeonRunProcessingRunState,
  type DungeonRunProcessingState,
} from "@/services/fellowship/dungeon-runs/dungeon-run-processing-state.ts";
import {
  type DungeonRunTrackerState,
  initialDungeonRunTrackerState,
} from "@/services/fellowship/dungeon-runs/track-dungeon-run.ts";
import {
  initialRequirementProcessorState,
  type RequirementObservationsByTargetId,
  type RequirementProcessorState,
} from "@/services/fellowship/requirements/requirement-processor-state.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";
import { makeWebSocketBroadcasterTestHarness } from "@/tests/common/harnesses/websocket-broadcaster-test-harness.ts";
import { runTest } from "@/tests/common/run-test.ts";

function createRunProcessingState({
  dungeonRun,
  requirementProcessor = initialRequirementProcessorState,
  runTracker = initialDungeonRunTrackerState,
}: {
  readonly dungeonRun?: DungeonRunProcessingRunState;
  readonly requirementProcessor?: RequirementProcessorState;
  readonly runTracker?: DungeonRunTrackerState;
} = {}): DungeonRunProcessingState {
  return {
    dungeonRun,
    requirementProcessor,
    runTracker,
  };
}

describe("publishDungeonRunState", () => {
  test("publishes an active run state", async () => {
    const program = E.gen(function* () {
      const webSocketBroadcasterHarness =
        yield* makeWebSocketBroadcasterTestHarness();

      const state = createRunProcessingState({
        dungeonRun: {
          startedAt: DateTime.makeUnsafe(1_000),
          status: "ACTIVE",
        },
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

      const state = createRunProcessingState({
        dungeonRun: {
          startedAt: DateTime.makeUnsafe(1_000),
          status: "ACTIVE",
        },
        requirementProcessor: {
          requirementObservations,
        },
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

      const state = createRunProcessingState({
        dungeonRun: {
          endedAt: DateTime.makeUnsafe(13_345),
          startedAt: DateTime.makeUnsafe(1_000),
          status: "COMPLETED",
        },
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
        state: createRunProcessingState(),
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
