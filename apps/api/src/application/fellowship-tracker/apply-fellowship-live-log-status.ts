import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Stream from "effect/Stream";

import { type FellowshipLiveLogItem } from "@frt/api/services/fellowship/fellowship-live-log.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

type ApplyFellowshipLiveLogStatusOptions<Error, R> = {
  readonly liveLog: Stream.Stream<FellowshipLiveLogItem, Error, R>;
  readonly setTracking: () => E.Effect<void>;
  readonly setWaitingForLogFile: () => E.Effect<void>;
};

export function applyFellowshipLiveLogStatus<Error, R>({
  liveLog,
  setTracking,
  setWaitingForLogFile,
}: ApplyFellowshipLiveLogStatusOptions<Error, R>): Stream.Stream<
  FellowshipEvent,
  Error,
  R
> {
  return liveLog.pipe(
    Stream.mapEffect((item): E.Effect<FellowshipEvent | undefined> => {
      return Match.value(item).pipe(
        Match.tag("WaitingForLogFile", () => {
          return setWaitingForLogFile().pipe(E.as(undefined));
        }),
        Match.tag("AttachedLogFile", ({ filePath, startOffset }) => {
          return setTracking().pipe(
            E.andThen(
              E.logInfo("Attached to Fellowship log file.", {
                filePath,
                startOffsetBytes: Number(startOffset),
              }),
            ),
            E.as(undefined),
          );
        }),
        Match.tag("Event", ({ event }) => {
          return E.succeed(event);
        }),
        Match.exhaustive,
      );
    }),
    Stream.filter((event): event is FellowshipEvent => {
      return event !== undefined;
    }),
  );
}
