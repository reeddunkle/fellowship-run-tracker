import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { FellowshipLogsEventDecodeError } from "@frt/api/errors/fellowship-logs-error.ts";
import {
  type FellowshipLogsConvertibleEvent,
  FellowshipLogsConvertibleEventSchema,
} from "@frt/api/services/fellowship-logs/validation/fellowship-logs-event-schema.ts";
import { type FellowshipLogsReport } from "@frt/api/services/fellowship-logs/validation/fellowship-logs-report-schema.ts";
import { FELLOWSHIP_EVENT } from "@frt/shared/fellowship/constants/fellowship-event.ts";
import { type DungeonStartEvent } from "@frt/shared/fellowship/validation/events/dungeon-start.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

import { convertFellowshipLogsEvent } from "./convert-fellowship-logs-event.ts";

type FellowshipLogsReportActor = NonNullable<
  FellowshipLogsReport["masterData"]["actors"]
>[number];

type FellowshipLogsEventContext = {
  readonly actors: ReadonlyArray<FellowshipLogsReportActor>;
  readonly event: FellowshipLogsConvertibleEvent;
  readonly reportStartTime: number;
};

function isConvertibleEvent(event: unknown): boolean {
  if (
    typeof event !== "object" ||
    event === null ||
    !("type" in event) ||
    typeof event.type !== "string"
  ) {
    return false;
  }

  return (
    event.type === "dungeonstart" ||
    event.type === "dungeonend" ||
    event.type === "cast" ||
    event.type === "death"
  );
}

function decodeEvent({
  actors,
  event,
  reportStartTime,
}: {
  readonly actors: ReadonlyArray<FellowshipLogsReportActor>;
  readonly event: unknown;
  readonly reportStartTime: number;
}) {
  return E.gen(function* () {
    const convertibleEvent = yield* Schema.decodeUnknownEffect(
      FellowshipLogsConvertibleEventSchema,
    )(event).pipe(
      E.mapError((cause) => {
        return new FellowshipLogsEventDecodeError({
          cause,
        });
      }),
    );

    if (
      convertibleEvent.type === "death" &&
      convertibleEvent.targetInstance === undefined
    ) {
      yield* E.logWarning(
        "Fellowship Logs death event is missing targetInstance.",
        {
          event: convertibleEvent,
          reportStartTime,
        },
      );
    }

    return {
      actors,
      event: convertibleEvent,
      reportStartTime,
    } satisfies FellowshipLogsEventContext;
  });
}

export function streamFellowshipLogsEvents<StreamError>(
  reportPages: Stream.Stream<FellowshipLogsReport, StreamError>,
): Stream.Stream<
  FellowshipEvent,
  StreamError | FellowshipLogsEventDecodeError
> {
  return reportPages.pipe(
    Stream.flatMap((reportPage) => {
      const actors = reportPage.masterData.actors ?? [];

      return Stream.fromIterable(reportPage.events.data).pipe(
        Stream.filter(isConvertibleEvent),
        Stream.mapEffect((event) => {
          return decodeEvent({
            actors,
            event,
            reportStartTime: reportPage.startTime,
          });
        }),
      );
    }),
    Stream.mapAccum(
      (): DungeonStartEvent | undefined => undefined,
      (dungeonStartEvent, context) => {
        const fellowshipEvent = convertFellowshipLogsEvent({
          actors: context.actors,
          dungeonStartEvent,
          event: context.event,
          reportStartTime: context.reportStartTime,
        });

        if (fellowshipEvent === undefined) {
          return [dungeonStartEvent, []] as const;
        }

        const nextDungeonStartEvent =
          fellowshipEvent.type === FELLOWSHIP_EVENT.DUNGEON_START
            ? fellowshipEvent
            : fellowshipEvent.type === FELLOWSHIP_EVENT.DUNGEON_END
              ? undefined
              : dungeonStartEvent;

        return [nextDungeonStartEvent, [fellowshipEvent]] as const;
      },
    ),
  );
}
