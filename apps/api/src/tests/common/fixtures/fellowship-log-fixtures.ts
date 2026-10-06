// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";

import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Stream from "effect/Stream";

import { NodeFileSystemLayer } from "@frt/api/layers/node-platform-layer.ts";
import { parseFellowshipEventStream } from "@frt/api/services/fellowship/parsing/parse-fellowship-event-stream.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

export const EVERDAWN_GROVE_64_TIMED_LOG_PATH = path.join(
  import.meta.dirname,
  "logs",
  "everdawn-grove-64-timed.txt",
);

export const EVERDAWN_GROVE_64_TIMED_EVENTS_SNAPSHOT_PATH = path.join(
  import.meta.dirname,
  "logs",
  "everdawn-grove-64-timed.events.jsonl",
);

export const readFellowshipLogLines = E.fn("readFellowshipLogLines")(function* (
  logFilePath: string,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const contents = yield* fileSystem.readFileString(logFilePath);

  return contents.split(/\r?\n/).filter((line) => {
    return line !== "";
  });
}, E.provide(NodeFileSystemLayer));

export const decodeFellowshipLogFile = E.fn("decodeFellowshipLogFile")(
  function* (logFilePath: string) {
    const lines = yield* readFellowshipLogLines(logFilePath);

    return yield* Stream.fromIterable(lines).pipe(
      parseFellowshipEventStream,
      Stream.runCollect,
    );
  },
);

export function formatFellowshipEventsSnapshot(
  events: ReadonlyArray<FellowshipEvent>,
): string {
  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}
