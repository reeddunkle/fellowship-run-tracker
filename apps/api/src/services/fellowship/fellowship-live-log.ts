import * as ByteSize from "effect/ByteSize";
import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Stream from "effect/Stream";

import { type LatestFileItem } from "@frt/api/services/filesystem/file-monitor-service.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

import { makeFellowshipLogLineInspector } from "./parsing/parse-fellowship-event-stream.ts";

export type FellowshipLiveLogItem =
  | {
      readonly _tag: "WaitingForLogFile";
    }
  | {
      readonly _tag: "AttachedLogFile";
      readonly filePath: string;
      readonly startOffset: ByteSize.ByteSize;
    }
  | {
      readonly _tag: "Event";
      readonly event: FellowshipEvent;
    };

export function parseFellowshipLiveLog<Error, R>(
  items: Stream.Stream<LatestFileItem, Error, R>,
): Stream.Stream<FellowshipLiveLogItem, Error, R> {
  return Stream.suspend(() => {
    const inspectLine = makeFellowshipLogLineInspector();

    return items.pipe(
      Stream.mapEffect((item): E.Effect<FellowshipLiveLogItem | undefined> => {
        return Match.value(item).pipe(
          Match.tag("WaitingForFile", () => {
            return E.succeed({
              _tag: "WaitingForLogFile",
            } satisfies FellowshipLiveLogItem);
          }),
          Match.tag("Attached", ({ file, startOffset }) => {
            return E.succeed({
              _tag: "AttachedLogFile",
              filePath: file.filePath,
              startOffset,
            } satisfies FellowshipLiveLogItem);
          }),
          Match.tag("Line", ({ line }) => {
            return inspectLine(line).pipe(
              E.map(({ event }) => {
                return event === undefined
                  ? undefined
                  : ({
                      _tag: "Event",
                      event,
                    } satisfies FellowshipLiveLogItem);
              }),
            );
          }),
          Match.exhaustive,
        );
      }),
      Stream.filter((item): item is FellowshipLiveLogItem => {
        return item !== undefined;
      }),
    );
  });
}

export function makeFellowshipLiveLogFromEvents<Error, R>({
  events,
  filePath,
}: {
  readonly events: Stream.Stream<FellowshipEvent, Error, R>;
  readonly filePath: string;
}): Stream.Stream<FellowshipLiveLogItem, Error, R> {
  return Stream.concat(
    Stream.succeed({
      _tag: "AttachedLogFile",
      filePath,
      startOffset: ByteSize.bytes(0),
    } satisfies FellowshipLiveLogItem),
    events.pipe(
      Stream.map((event) => {
        return {
          _tag: "Event",
          event,
        } satisfies FellowshipLiveLogItem;
      }),
    ),
  );
}
