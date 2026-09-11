import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Stream from "effect/Stream";

import { type FellowshipLiveStatus } from "@/services/fellowship/fellowship-service.ts";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";

import { type FellowshipTrackerConfigurationSource } from "./fellowship-tracker-service-types.ts";

type ObserveFellowshipLiveStatusOptions = {
  readonly dungeonId: DungeonId;
  readonly liveStatus: Stream.Stream<FellowshipLiveStatus, unknown>;
  readonly setTracking: () => E.Effect<void>;
  readonly setWaitingForLogFile: () => E.Effect<void>;
  readonly source: FellowshipTrackerConfigurationSource;
};

export function observeFellowshipLiveStatus({
  dungeonId,
  liveStatus,
  setTracking,
  setWaitingForLogFile,
  source,
}: ObserveFellowshipLiveStatusOptions) {
  return liveStatus.pipe(
    Stream.runForEach((liveStatusValue) => {
      return Match.value(liveStatusValue).pipe(
        Match.tag("WaitingForLogFile", () => {
          return setWaitingForLogFile();
        }),
        Match.tag("MonitoringLogFile", () => {
          return setTracking();
        }),
        Match.exhaustive,
      );
    }),
    E.tapCause((cause) => {
      return E.logError("Fellowship live status stream failed.", {
        cause,
        dungeonId,
        source,
      });
    }),
  );
}
