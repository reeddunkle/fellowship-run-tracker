import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { parseFellowshipEventStream } from "@frt/api/services/fellowship/parsing/parse-fellowship-event-stream.ts";
import {
  DUNGEON_START_CONFIGURATION,
  DUNGEON_START_LINE,
} from "@frt/api/tests/common/fixtures/dungeon-start-fixtures.ts";
import { makeFellowshipTrackerTestHarness } from "@frt/api/tests/common/harnesses/fellowship-tracker-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const UNREFERENCED_ABILITY_ACTIVATED_LINE =
  '2026-08-19T22:35:03.174-04:00|ABILITY_ACTIVATED|Player-353371984|"billy"|979|"Shockwave"|0|UnrecognizedType-0|"0"|41947|41947|5738|-20070.117188|20676.664062|5.751935|[(3,0.00,7580.48),(4,50.00,130.00)]';

describe("FellowshipTracker dungeon run publishing", () => {
  test("persists an unreferenced observation without publishing a message", async () => {
    const result = await E.gen(function* () {
      const eventsProcessed = yield* Deferred.make<void>();

      const harness = yield* makeFellowshipTrackerTestHarness({
        configuration: DUNGEON_START_CONFIGURATION,
        liveEvents: parseFellowshipEventStream(
          Stream.make(DUNGEON_START_LINE, UNREFERENCED_ABILITY_ACTIVATED_LINE),
        ).pipe(
          Stream.concat(
            Stream.fromEffect(
              Deferred.succeed(eventsProcessed, undefined),
            ).pipe(Stream.drain),
          ),
          Stream.concat(Stream.never),
        ),
      });

      return yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        yield* tracker.start({
          configurationId: harness.configurationId,
        });

        yield* Deferred.await(eventsProcessed);

        return {
          messages:
            yield* harness.dungeonRunWebSocketBroadcasterHarness.getParsedMessages(),
          observations: yield* harness.getObservations,
        };
      }).pipe(E.provide(harness.layer));
    }).pipe(E.scoped, runTest);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toMatchObject({
      state: {
        dungeonRun: {
          status: "ACTIVE",
        },
      },
    });
    expect(
      result.observations.map((observation) => {
        return {
          targetId: observation.targetId,
          type: observation.type,
        };
      }),
    ).toEqual([
      {
        targetId: "11",
        type: "DUNGEON_START",
      },
      {
        targetId: "979",
        type: "ABILITY_ACTIVATED",
      },
    ]);
  });
});
