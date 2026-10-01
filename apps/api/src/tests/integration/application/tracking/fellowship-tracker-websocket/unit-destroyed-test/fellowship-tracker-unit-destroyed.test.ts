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

describe("FellowshipTracker UNIT_DESTROYED integration", () => {
  test("records UNIT_DESTROYED events as UNIT_DEATH observations", async () => {
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

        const finalMessage = A.last(messages);

        expect(finalMessage._tag).toBe("Some");

        if (finalMessage._tag === "None") {
          return;
        }

        const decodedFinalMessage = yield* Schema.decodeUnknownEffect(
          DungeonRunApiMessageSchema,
        )(finalMessage.value);

        expectDungeonRunObservations({
          count: 2,
          observations: decodedFinalMessage.state.observations,
          targetId: "115",
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
          targetId: "31",
          type: "ENCOUNTER_START",
        });

        // Encounter not successful
        expectDungeonRunObservations({
          count: 0,
          observations: decodedFinalMessage.state.observations,
          targetId: "31",
          type: "ENCOUNTER_END",
        });
      }),
    ).pipe(E.provide(NodePath.layer));

    await runTest(program);
  });
});
