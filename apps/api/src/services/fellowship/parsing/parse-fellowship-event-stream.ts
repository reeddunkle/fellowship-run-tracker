import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import { type FellowshipEventInvalidError } from "@frt/api/errors/fellowship-event-error.ts";
import { getEventType } from "@frt/api/services/fellowship/parsing/get-event-type.ts";
import {
  type FellowshipEvent,
  isParsedFellowshipEventType,
} from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

import { parseFellowshipLogLine } from "./parse-fellowship-log-line.ts";

function getParseIssue(error: FellowshipEventInvalidError) {
  return error.cause instanceof Error
    ? error.cause.message
    : String(error.cause);
}

export function parseFellowshipEventStream<Error, R>(
  lines: Stream.Stream<string, Error, R>,
): Stream.Stream<FellowshipEvent, Error, R> {
  return Stream.suspend(() => {
    const reportedEventTypes = new Set<string>();

    const logInvalidLine = (error: FellowshipEventInvalidError) => {
      const eventType = getEventType(error.line) ?? "unknown";

      const firstForEventType = !reportedEventTypes.has(eventType);

      reportedEventTypes.add(eventType);

      return E.all(
        [
          firstForEventType
            ? E.logWarning(
                "Fellowship log lines of this type can't be parsed; later failures are logged at debug level.",
                { eventType, issue: getParseIssue(error) },
              )
            : E.void,
          E.logDebug("Failed to parse Fellowship log line.", {
            eventType,
            line: error.line,
          }),
        ],
        { discard: true },
      );
    };

    return lines.pipe(
      Stream.filter((line) => {
        return isParsedFellowshipEventType(getEventType(line));
      }),
      Stream.mapEffect((line) => {
        return parseFellowshipLogLine(line).pipe(
          E.catchTags({
            FellowshipEventInvalidError: (error) => {
              return logInvalidLine(error).pipe(E.as(undefined));
            },
            FellowshipEventUnsupportedTypeError: () => {
              return E.void;
            },
          }),
        );
      }),
      Stream.filter((event): event is FellowshipEvent => event !== undefined),
    );
  });
}
