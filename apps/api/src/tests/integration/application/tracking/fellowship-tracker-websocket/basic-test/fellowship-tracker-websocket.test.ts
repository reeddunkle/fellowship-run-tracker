import { NodePath } from "@effect/platform-node";
import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { expectDungeonRunObservations } from "@frt/api/tests/common/expect-dungeon-run-observations.ts";
import { makeFellowshipTrackerIntegrationTestHarness } from "@frt/api/tests/common/harnesses/fellowship-tracker-integration-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { DungeonRunApiMessageSchema } from "@frt/api-contract/websocket/dungeon-run/dungeon-run-api-message-schema.ts";

import { configuration } from "./configuration.ts";

describe("FellowshipTracker dungeon run WebSocket messages", () => {
  test("broadcasts dungeon run state updates while processing a run", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const path = yield* Path.Path;

        const { dungeonRunWebSocketBroadcasterHarness, layer } =
          yield* makeFellowshipTrackerIntegrationTestHarness();

        const logFilePath = path.join(import.meta.dirname, "log.txt");

        yield* E.gen(function* () {
          const fellowshipTracker = yield* FellowshipTracker;

          yield* fellowshipTracker.replayLog({
            configuration,
            logFilePath,
          });
        }).pipe(E.provide(layer));

        const messages =
          yield* dungeonRunWebSocketBroadcasterHarness.getParsedMessages();

        expect(messages.length).toBeGreaterThan(0);

        const firstMessage = messages[0];

        const decodedFirstMessage = yield* Schema.decodeUnknownEffect(
          DungeonRunApiMessageSchema,
        )(firstMessage);

        expect(decodedFirstMessage).toMatchObject({
          state: {
            dungeonRun: {
              startedAtMilliseconds: expect.any(Number),
              status: "ACTIVE",
            },
          },
          version: 1,
        });

        const finalMessage = A.last(messages);

        expect(finalMessage._tag).toBe("Some");

        if (finalMessage._tag === "None") {
          return;
        }

        const decodedFinalMessage = yield* Schema.decodeUnknownEffect(
          DungeonRunApiMessageSchema,
        )(finalMessage.value);

        expect(decodedFinalMessage.state.dungeonRun).toMatchObject({
          endedAtMilliseconds: expect.any(Number),
          startedAtMilliseconds: expect.any(Number),
        });

        expectDungeonRunObservations({
          count: 2,
          observations: decodedFinalMessage.state.observations,
          targetId: "42",
          type: "UNIT_DEATH",
        });

        expectDungeonRunObservations({
          count: 2,
          observations: decodedFinalMessage.state.observations,
          targetId: "41",
          type: "UNIT_DEATH",
        });

        expectDungeonRunObservations({
          count: 2,
          observations: decodedFinalMessage.state.observations,
          targetId: "274",
          type: "UNIT_DEATH",
        });

        expectDungeonRunObservations({
          count: 1,
          observations: decodedFinalMessage.state.observations,
          targetId: "30",
          type: "ENCOUNTER_START",
        });

        expectDungeonRunObservations({
          count: 1,
          observations: decodedFinalMessage.state.observations,
          targetId: "30",
          type: "ENCOUNTER_END",
        });
      }),
    ).pipe(E.provide(NodePath.layer));

    await runTest(program);
  });
});
