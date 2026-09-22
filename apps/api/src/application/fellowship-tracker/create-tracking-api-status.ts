import * as Match from "effect/Match";

import {
  type TrackingApiFailure,
  type TrackingApiSource,
  type TrackingApiStatus,
} from "@frt/api-contract/application/fellowship-tracker/tracking-api-schema.ts";

import {
  type FellowshipTrackerConfigurationSource,
  type FellowshipTrackerFailure,
  type FellowshipTrackerStatus,
} from "./fellowship-tracker-service.ts";

function createTrackingApiSource(
  source: FellowshipTrackerConfigurationSource,
): TrackingApiSource {
  return Match.value(source).pipe(
    Match.when(
      {
        _tag: "Persisted",
      },
      ({ configurationId }): TrackingApiSource => {
        return {
          configurationId,
          type: "Persisted",
        };
      },
    ),
    Match.when(
      {
        _tag: "External",
      },
      (): TrackingApiSource => {
        return {
          type: "External",
        };
      },
    ),
    Match.exhaustive,
  );
}

function createTrackingApiFailure(
  failure: FellowshipTrackerFailure,
): TrackingApiFailure {
  return Match.value(failure).pipe(
    Match.when(
      {
        _tag: "Configuration",
      },
      (): TrackingApiFailure => {
        return {
          type: "Configuration",
        };
      },
    ),
    Match.when(
      {
        _tag: "FileSystem",
      },
      (): TrackingApiFailure => {
        return {
          type: "FileSystem",
        };
      },
    ),
    Match.when(
      {
        _tag: "Unexpected",
      },
      (): TrackingApiFailure => {
        return {
          type: "Unexpected",
        };
      },
    ),
    Match.exhaustive,
  );
}

export function createTrackingApiStatus(
  status: FellowshipTrackerStatus,
): TrackingApiStatus {
  return Match.value(status).pipe(
    Match.when(
      {
        _tag: "Idle",
      },
      (): TrackingApiStatus => {
        return {
          status: "Idle",
        };
      },
    ),
    Match.when(
      {
        _tag: "WaitingForLogFile",
      },
      ({ dungeonId, source }): TrackingApiStatus => {
        return {
          dungeonId,
          source: createTrackingApiSource(source),
          status: "WaitingForLogFile",
        };
      },
    ),
    Match.when(
      {
        _tag: "Tracking",
      },
      ({ dungeonId, source }): TrackingApiStatus => {
        return {
          dungeonId,
          source: createTrackingApiSource(source),
          status: "Tracking",
        };
      },
    ),
    Match.when(
      {
        _tag: "Failed",
      },
      ({ dungeonId, failure, source }): TrackingApiStatus => {
        return {
          dungeonId,
          failure: createTrackingApiFailure(failure),
          source: createTrackingApiSource(source),
          status: "Failed",
        };
      },
    ),
    Match.exhaustive,
  );
}
