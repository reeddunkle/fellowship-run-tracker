import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import { type FellowshipEventInvalidError } from "@frt/api/errors/fellowship-event-error.ts";
import { getEventType } from "@frt/api/services/fellowship/parsing/get-event-type.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

import { parseFellowshipLogLine } from "./parse-fellowship-log-line.ts";

function getParseIssue(error: FellowshipEventInvalidError) {
  return error.cause instanceof Error
    ? error.cause.message
    : String(error.cause);
}

export type InspectedFellowshipLogLine = {
  readonly event: FellowshipEvent | undefined;
  readonly line: string;
};

export function makeFellowshipLogLineInspector(): (
  line: string,
) => E.Effect<InspectedFellowshipLogLine> {
  const reportedEventTypes = new Set<string>();

  const logInvalidLine = (error: FellowshipEventInvalidError) => {
    const eventType = getEventType(error.line.split("|")) ?? "unknown";

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

  return (line) => {
    return parseFellowshipLogLine(line).pipe(
      E.catchTag("FellowshipEventInvalidError", (error) => {
        return logInvalidLine(error).pipe(E.as(undefined));
      }),
      E.map((event) => {
        return { event, line };
      }),
    );
  };
}

export function inspectFellowshipLogLines<Error, R>(
  lines: Stream.Stream<string, Error, R>,
): Stream.Stream<InspectedFellowshipLogLine, Error, R> {
  return Stream.suspend(() => {
    return lines.pipe(Stream.mapEffect(makeFellowshipLogLineInspector()));
  });
}

export function parseFellowshipEventStream<Error, R>(
  lines: Stream.Stream<string, Error, R>,
): Stream.Stream<FellowshipEvent, Error, R> {
  return inspectFellowshipLogLines(lines).pipe(
    Stream.map(({ event }) => event),
    Stream.filter((event): event is FellowshipEvent => event !== undefined),
  );
}
