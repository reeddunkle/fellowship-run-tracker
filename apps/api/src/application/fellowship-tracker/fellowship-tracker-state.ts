import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as SubscriptionRef from "effect/SubscriptionRef";

import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";

import {
  type ActiveTracker,
  type FellowshipTrackerConfigurationSource,
  type FellowshipTrackerFailure,
  type FellowshipTrackerStatus,
} from "./fellowship-tracker-service.ts";

type FellowshipTrackerStatusContext = {
  readonly dungeonId: DungeonId;
  readonly source: FellowshipTrackerConfigurationSource;
};

export function makeFellowshipTrackerState() {
  return E.gen(function* () {
    const activeTrackerRef = yield* Ref.make<Option.Option<ActiveTracker>>(
      Option.none(),
    );

    const statusRef = yield* SubscriptionRef.make<FellowshipTrackerStatus>({
      _tag: "Idle",
    });

    const clearActiveTracker = Ref.set(activeTrackerRef, Option.none());

    const getActiveTracker = Ref.get(activeTrackerRef);

    const setActiveTracker = (tracker: ActiveTracker) => {
      return Ref.set(activeTrackerRef, Option.some(tracker));
    };

    const setFailed = ({
      dungeonId,
      failure,
      source,
    }: FellowshipTrackerStatusContext & {
      readonly failure: FellowshipTrackerFailure;
    }) => {
      return SubscriptionRef.set(statusRef, {
        _tag: "Failed",
        dungeonId,
        failure,
        source,
      });
    };

    const setIdle = SubscriptionRef.set(statusRef, {
      _tag: "Idle",
    });

    const setTracking = ({
      dungeonId,
      source,
    }: FellowshipTrackerStatusContext) => {
      return SubscriptionRef.set(statusRef, {
        _tag: "Tracking",
        dungeonId,
        source,
      });
    };

    const setWaitingForLogFile = ({
      dungeonId,
      source,
    }: FellowshipTrackerStatusContext) => {
      return SubscriptionRef.set(statusRef, {
        _tag: "WaitingForLogFile",
        dungeonId,
        source,
      });
    };

    const status = SubscriptionRef.get(statusRef);

    const statusChanges = SubscriptionRef.changes(statusRef);

    return {
      clearActiveTracker,
      getActiveTracker,
      setActiveTracker,
      setFailed,
      setIdle,
      setTracking,
      setWaitingForLogFile,
      status,
      statusChanges,
    };
  });
}
