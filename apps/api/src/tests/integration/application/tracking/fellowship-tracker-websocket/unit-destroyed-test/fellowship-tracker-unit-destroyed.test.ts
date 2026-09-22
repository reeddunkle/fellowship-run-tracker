import { NodePath } from "@effect/platform-node";
import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
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

        const greedspawnObservations =
          decodedFinalMessage.state.observations.filter((observation) => {
            return (
              observation.type === "UNIT_DEATH" &&
              observation.targetId === "115"
            );
          });

        expect(greedspawnObservations).toEqual([
          {
            targetId: "115",
            timestampMilliseconds: expect.any(Number),
            type: "UNIT_DEATH",
          },
          {
            targetId: "115",
            timestampMilliseconds: expect.any(Number),
            type: "UNIT_DEATH",
          },
        ]);

        const shadowlordObservations =
          decodedFinalMessage.state.observations.filter((observation) => {
            return (
              observation.type === "UNIT_DEATH" &&
              observation.targetId === "274"
            );
          });

        expect(shadowlordObservations).toEqual([
          {
            targetId: "274",
            timestampMilliseconds: expect.any(Number),
            type: "UNIT_DEATH",
          },
          {
            targetId: "274",
            timestampMilliseconds: expect.any(Number),
            type: "UNIT_DEATH",
          },
        ]);

        const bossPullObservations =
          decodedFinalMessage.state.observations.filter((observation) => {
            return (
              observation.type === "ENCOUNTER_START" &&
              observation.targetId === "31"
            );
          });

        expect(bossPullObservations).toHaveLength(1);

        const bossKillObservations =
          decodedFinalMessage.state.observations.filter((observation) => {
            return (
              observation.type === "ENCOUNTER_END" &&
              observation.targetId === "31"
            );
          });

        // Encounter not successful
        expect(bossKillObservations).toHaveLength(0);
      }),
    ).pipe(E.provide(NodePath.layer));

    await runTest(program);
  });
});
