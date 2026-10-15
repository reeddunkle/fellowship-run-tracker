import * as ByteSize from "effect/ByteSize";
import * as E from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { applyFellowshipLiveLogStatus } from "@frt/api/application/fellowship-tracker/apply-fellowship-live-log-status.ts";
import { type FellowshipLiveLogItem } from "@frt/api/services/fellowship/fellowship-live-log.ts";
import { DUNGEON_START_EVENTS } from "@frt/api/tests/common/fixtures/dungeon-start-fixtures.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

describe("applyFellowshipLiveLogStatus", () => {
  test("sets status from file states in order and passes events through", async () => {
    const result = await E.gen(function* () {
      const [event] = yield* Stream.runCollect(DUNGEON_START_EVENTS);

      if (event === undefined) {
        return yield* E.die("Expected a dungeon start event.");
      }

      const calls = yield* Ref.make<ReadonlyArray<string>>([]);

      const record = (call: string) => {
        return Ref.update(calls, (currentCalls) => {
          return [...currentCalls, call];
        });
      };

      const liveLogItems: ReadonlyArray<FellowshipLiveLogItem> = [
        { _tag: "WaitingForLogFile" },
        {
          _tag: "AttachedLogFile",
          filePath: "/logs/fellowship.txt",
          startOffset: ByteSize.bytes(0),
        },
        { _tag: "Event", event },
        { _tag: "WaitingForLogFile" },
      ];

      const liveLog = Stream.fromIterable(liveLogItems);

      const events = yield* applyFellowshipLiveLogStatus({
        liveLog: liveLog.pipe(
          Stream.tap((item) => {
            return item._tag === "Event" ? record("event") : E.void;
          }),
        ),
        setTracking: () => {
          return record("setTracking");
        },
        setWaitingForLogFile: () => {
          return record("setWaitingForLogFile");
        },
      }).pipe(Stream.runCollect);

      return {
        calls: yield* Ref.get(calls),
        event,
        events,
      };
    }).pipe(runTest);

    expect(result.calls).toEqual([
      "setWaitingForLogFile",
      "setTracking",
      "event",
      "setWaitingForLogFile",
    ]);

    expect(result.events).toEqual([result.event]);
  });
});
