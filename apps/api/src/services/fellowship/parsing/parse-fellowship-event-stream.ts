import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import { getEventType } from "@frt/api/services/fellowship/parsing/get-event-type.ts";
import {
  type FellowshipEvent,
  isParsedFellowshipEventType,
} from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

import { parseFellowshipLogLine } from "./parse-fellowship-log-line.ts";

export function parseFellowshipEventStream<Error, R>(
  lines: Stream.Stream<string, Error, R>,
): Stream.Stream<FellowshipEvent, Error, R> {
  return lines.pipe(
    Stream.filter((line) => {
      return isParsedFellowshipEventType(getEventType(line));
    }),
    Stream.mapEffect((line) => {
      return parseFellowshipLogLine(line).pipe(
        E.catchTags({
          FellowshipEventInvalidError: (error) => {
            return E.logError("Failed to parse Fellowship log line.", {
              error,
            }).pipe(E.as(undefined));
          },
          FellowshipEventUnsupportedTypeError: () => {
            return E.void;
          },
        }),
      );
    }),
    Stream.filter((event): event is FellowshipEvent => event !== undefined),
  );
}
