import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import {
  DUNGEON_RUN_PROCESSING_EVENT,
  type DungeonRunProcessingEvent,
} from "@frt/api/services/fellowship/dungeon-runs/process-dungeon-run-event.ts";
import { LiveSplit } from "@frt/api/services/live-split/live-split-service.ts";
import {
  LiveSplitGateway,
  type LiveSplitGatewayShape,
} from "@frt/api/services/live-split-gateway/live-split-gateway-service.ts";
import { makeRecordingTracer } from "@frt/api/tests/common/make-recording-tracer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { type ConnectionStatus } from "@frt/api/util/connection-manager/make-connection-manager.ts";

const TIMESTAMP = DateTime.makeUnsafe("2026-01-01T00:00:00Z");

const RUN_STARTED_EVENT = {
  timestamp: TIMESTAMP,
  type: DUNGEON_RUN_PROCESSING_EVENT.RUN_STARTED,
} satisfies DungeonRunProcessingEvent;

const MILESTONE_COMPLETED_EVENT = {
  milestone: {
    elapsedMilliseconds: 1000,
    label: "First boss",
    milestoneId: "first-boss",
    timestamp: TIMESTAMP,
  },
  type: DUNGEON_RUN_PROCESSING_EVENT.MILESTONE_COMPLETED,
} satisfies DungeonRunProcessingEvent;

const RUN_COMPLETED_EVENT = {
  timestamp: TIMESTAMP,
  type: DUNGEON_RUN_PROCESSING_EVENT.RUN_COMPLETED,
} satisfies DungeonRunProcessingEvent;

const RUN_EXITED_EVENT = {
  timestamp: TIMESTAMP,
  type: DUNGEON_RUN_PROCESSING_EVENT.RUN_EXITED,
} satisfies DungeonRunProcessingEvent;

function makeLiveSplitGatewayDouble(status: ConnectionStatus) {
  const commands: Array<string> = [];

  const recordCommand = (command: string) => {
    return () => {
      return E.sync(() => {
        commands.push(command);
      });
    };
  };

  const layer = Layer.succeed(LiveSplitGateway, {
    connect: () => {
      return E.void;
    },
    disconnect: () => {
      return E.void;
    },
    getCurrentTime: () => {
      return E.succeed("0:00:00");
    },
    getSplitIndex: () => {
      return E.succeed(0);
    },
    getTimerPhase: () => {
      return E.succeed("NotRunning");
    },
    pause: recordCommand("pause"),
    reset: recordCommand("reset"),
    setComparison: recordCommand("setComparison"),
    setCurrentSplitName: recordCommand("setCurrentSplitName"),
    split: recordCommand("split"),
    startTimer: recordCommand("startTimer"),
    status: E.succeed(status),
    statusChanges: Stream.make(status),
    switchSplits: recordCommand("switchSplits"),
  } satisfies LiveSplitGatewayShape);

  return { commands, layer };
}

function handleRunEvents(
  status: ConnectionStatus,
  processingEvents: ReadonlyArray<DungeonRunProcessingEvent>,
) {
  const gateway = makeLiveSplitGatewayDouble(status);
  const { spans, tracer } = makeRecordingTracer();

  return E.gen(function* () {
    const liveSplit = yield* LiveSplit;

    yield* E.forEach(processingEvents, liveSplit.handleRunEvent, {
      discard: true,
    });

    return {
      commands: gateway.commands,
      spanNames: spans.map((span) => {
        return span.name;
      }),
    };
  }).pipe(
    E.withTracer(tracer),
    E.provide(LiveSplit.layerNoDeps.pipe(Layer.provide(gateway.layer))),
    runTest,
  );
}

describe("LiveSplit.handleRunEvent", () => {
  describe("when LiveSplit is disconnected", () => {
    test("sends no gateway commands and records no LiveSplit spans", async () => {
      const { commands, spanNames } = await handleRunEvents(
        { _tag: "Disconnected" },
        [
          RUN_STARTED_EVENT,
          MILESTONE_COMPLETED_EVENT,
          RUN_COMPLETED_EVENT,
          RUN_EXITED_EVENT,
        ],
      );

      expect(commands).toEqual([]);
      expect(
        spanNames.filter((spanName) => {
          return spanName.startsWith("LiveSplit");
        }),
      ).toEqual([]);
    });
  });

  describe("when LiveSplit is connected", () => {
    test("resets and starts the timer when a run starts", async () => {
      const { commands, spanNames } = await handleRunEvents(
        { _tag: "Connected" },
        [RUN_STARTED_EVENT],
      );

      expect(commands).toEqual(["reset", "startTimer"]);
      expect(spanNames).toContain("LiveSplit.handleRunEvent");
    });

    test("splits when a milestone completes", async () => {
      const { commands } = await handleRunEvents({ _tag: "Connected" }, [
        MILESTONE_COMPLETED_EVENT,
      ]);

      expect(commands).toEqual(["split"]);
    });

    test("pauses when a run completes", async () => {
      const { commands } = await handleRunEvents({ _tag: "Connected" }, [
        RUN_COMPLETED_EVENT,
      ]);

      expect(commands).toEqual(["pause"]);
    });

    test("pauses when a run exits", async () => {
      const { commands } = await handleRunEvents({ _tag: "Connected" }, [
        RUN_EXITED_EVENT,
      ]);

      expect(commands).toEqual(["pause"]);
    });
  });
});
