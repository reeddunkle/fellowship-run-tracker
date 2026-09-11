import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import { getEventType } from "@/services/fellowship/parsing/get-event-type.ts";
import {
  type FellowshipEvent,
  isParsedFellowshipEventType,
} from "@/services/fellowship/validation/fellowship-event-schema.ts";

import { parseFellowshipLogLine } from "./parse-fellowship-log-line.ts";

export function parseFellowshipEventStream<E, R>(
  lines: Stream.Stream<string, E, R>,
): Stream.Stream<FellowshipEvent, E, R> {
  return lines.pipe(
    Stream.filter((line) => {
      return isParsedFellowshipEventType(getEventType(line));
    }),
    Stream.mapEffect((line) => {
      return parseFellowshipLogLine(line).pipe(
        E.catchTags({
          FellowshipInvalidEventError: (error) => {
            return E.logError("Failed to parse Fellowship log line.", {
              error,
            }).pipe(E.as(undefined));
          },
          FellowshipUnsupportedEventTypeError: () => {
            return E.void;
          },
        }),
      );
    }),
    Stream.filter((event): event is FellowshipEvent => event !== undefined),
  );
}
