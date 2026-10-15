import * as ByteSize from "effect/ByteSize";
import * as E from "effect/Effect";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import {
  makeFellowshipLiveLogFromEvents,
  parseFellowshipLiveLog,
} from "@frt/api/services/fellowship/fellowship-live-log.ts";
import { type LatestFileItem } from "@frt/api/services/filesystem/file-monitor-service.ts";
import {
  DUNGEON_START_EVENTS,
  DUNGEON_START_LINE,
} from "@frt/api/tests/common/fixtures/dungeon-start-fixtures.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const FILE = {
  createdAtEpochMilliseconds: 0,
  fileId: "fellowship",
  filePath: "/logs/fellowship.txt",
  modifiedAtEpochMilliseconds: 0,
  size: ByteSize.bytes(100),
};

describe("parseFellowshipLiveLog", () => {
  test("maps file states and parses lines into events, dropping unparseable lines", async () => {
    const latestFileItems: ReadonlyArray<LatestFileItem> = [
      { _tag: "WaitingForFile" },
      { _tag: "Attached", file: FILE, startOffset: ByteSize.bytes(10) },
      { _tag: "Line", line: DUNGEON_START_LINE },
      { _tag: "Line", line: "not a fellowship log line" },
    ];

    const items = await Stream.fromIterable(latestFileItems).pipe(
      parseFellowshipLiveLog,
      Stream.runCollect,
      runTest,
    );

    expect(items.map((item) => item._tag)).toEqual([
      "WaitingForLogFile",
      "AttachedLogFile",
      "Event",
    ]);

    expect(items[1]).toEqual({
      _tag: "AttachedLogFile",
      filePath: FILE.filePath,
      startOffset: ByteSize.bytes(10),
    });
  });
});

describe("makeFellowshipLiveLogFromEvents", () => {
  test("attaches at the start of the file before emitting events", async () => {
    const result = await E.gen(function* () {
      const events = yield* Stream.runCollect(DUNGEON_START_EVENTS);

      const items = yield* makeFellowshipLiveLogFromEvents({
        events: DUNGEON_START_EVENTS,
        filePath: FILE.filePath,
      }).pipe(Stream.runCollect);

      return { events, items };
    }).pipe(runTest);

    expect(result.items).toEqual([
      {
        _tag: "AttachedLogFile",
        filePath: FILE.filePath,
        startOffset: ByteSize.bytes(0),
      },
      ...result.events.map((event) => {
        return { _tag: "Event", event };
      }),
    ]);
  });
});
