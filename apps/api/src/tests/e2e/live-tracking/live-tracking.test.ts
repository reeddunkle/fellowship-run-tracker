import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Schedule from "effect/Schedule";
import { describe, expect, test } from "vitest";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import {
  awaitTrackingStatus,
  makeApiClient,
  makeLiveTrackingTestHarness,
  openDungeonRunMessages,
  replayScenarioLog,
  seedLiveTrackingScenario,
} from "@frt/api/tests/e2e/live-tracking/live-tracking-test-harness.ts";
import { godfallQuarry64TimedScenario } from "@frt/api/tests/e2e/live-tracking/scenarios/godfall-quarry-64-timed/scenario.ts";

const LIVE_TRACKING_TEST_TIMEOUT = 30_000;
const HISTORY_POLL_INTERVAL = "50 millis";
const HISTORY_POLL_TIMEOUT = "5 seconds";

describe("live tracking", () => {
  test(
    "streams a timed Godfall Quarry run over the API while its log is written, then records it in history",
    async () => {
      const scenario = godfallQuarry64TimedScenario;

      const result = await E.gen(function* () {
        const harness = yield* makeLiveTrackingTestHarness();

        return yield* E.gen(function* () {
          const configurationId = yield* seedLiveTrackingScenario({
            logDirectory: harness.logDirectory,
            scenario,
          });

          const client = yield* makeApiClient();
          const dungeonRunMessages = yield* openDungeonRunMessages();

          const trackingStatus = yield* client.tracking.startTracking({
            payload: { configurationId },
          });

          yield* awaitTrackingStatus("WaitingForLogFile");

          const replayFinished = yield* Deferred.make<void>();

          const replayFiber = yield* replayScenarioLog({
            logDirectory: harness.logDirectory,
            scenario,
          }).pipe(
            E.ensuring(Deferred.succeed(replayFinished, undefined)),
            E.forkScoped,
          );

          const activeMessage = yield* dungeonRunMessages.takeUntil(
            (message) => {
              return message.state.dungeonRun?.status === "ACTIVE";
            },
          );

          const isReplayFinishedWhenActive =
            yield* Deferred.isDone(replayFinished);

          const completedMessage = yield* dungeonRunMessages.takeUntil(
            (message) => {
              return message.state.dungeonRun?.status === "COMPLETED";
            },
          );

          yield* Fiber.join(replayFiber);

          const pollHistoryUntilRunIsPersisted = client.dungeonRun
            .getDungeonRunHistory({
              params: {
                dungeonId: scenario.configuration.dungeonId,
                dungeonLevel: scenario.configuration.dungeonLevel,
              },
            })
            .pipe(
              E.repeat({
                schedule: Schedule.spaced(HISTORY_POLL_INTERVAL),
                until: (polledHistory) => {
                  return polledHistory.ownRunCount === 1;
                },
              }),
              E.timeout(HISTORY_POLL_TIMEOUT),
            );

          const history = yield* pollHistoryUntilRunIsPersisted;

          yield* client.tracking.stopTracking();

          return {
            activeMessage,
            completedMessage,
            history,
            isReplayFinishedWhenActive,
            trackingStatus,
          };
        }).pipe(E.provide(harness.layer));
      }).pipe(E.scoped, E.provide(NodePlatformLayer), runTest);

      expect(result.trackingStatus.status).toBe("Starting");
      expect(result.isReplayFinishedWhenActive).toBe(false);
      expect(result.activeMessage.state.dungeonRun?.endedAtMilliseconds).toBe(
        null,
      );
      expect(
        result.completedMessage.state.dungeonRun?.endedAtMilliseconds,
      ).not.toBeNull();
      expect(result.history.ownRunCount).toBe(1);
    },
    LIVE_TRACKING_TEST_TIMEOUT,
  );
});
