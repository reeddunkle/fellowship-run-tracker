import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import type * as Fiber from "effect/Fiber";
import type * as Ref from "effect/Ref";
import type * as Stream from "effect/Stream";

import { type LocalLogDungeonRunPersistence } from "@/application/dungeon-run-processing/local-log-dungeon-run-persistence.ts";
import { type ConfigurationDAOError } from "@/errors/configuration-dao-error.ts";
import {
  type FellowshipTrackerAlreadyRunningError,
  type FellowshipTrackerConfigurationNotFoundError,
} from "@/errors/fellowship-tracker-error.ts";
import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";
import { type DungeonRunProcessingState } from "@/services/fellowship/dungeon-runs/dungeon-run-processing-state.ts";
import { type FellowshipLiveStatus } from "@/services/fellowship/fellowship-service.ts";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";
import { type FellowshipEvent } from "@/services/fellowship/validation/fellowship-event-schema.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

export type FellowshipTrackerConfigurationSource =
  | {
      readonly _tag: "Persisted";
      readonly configurationId: ConfigurationId;
    }
  | {
      readonly _tag: "External";
    };

export type FellowshipTrackerFailure =
  | { readonly _tag: "Configuration" }
  | { readonly _tag: "FileSystem" }
  | { readonly _tag: "Unexpected" };

export type FellowshipTrackerStatus =
  | {
      readonly _tag: "Idle";
    }
  | {
      readonly _tag: "WaitingForLogFile";
      readonly dungeonId: DungeonId;
      readonly source: FellowshipTrackerConfigurationSource;
    }
  | {
      readonly _tag: "Tracking";
      readonly dungeonId: DungeonId;
      readonly source: FellowshipTrackerConfigurationSource;
    }
  | {
      readonly _tag: "Failed";
      readonly dungeonId: DungeonId;
      readonly failure: FellowshipTrackerFailure;
      readonly source: FellowshipTrackerConfigurationSource;
    };

type StartFellowshipTrackerOptions = {
  readonly configurationId: ConfigurationId;
};

type StartFellowshipTrackerConfigurationOptions = {
  readonly configuration: FellowshipMilestoneConfiguration;
};

type ReplayFellowshipTrackerLogOptions = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly logFilePath: string;
};

export type FellowshipTrackerStartError =
  | ConfigurationDAOError
  | FellowshipTrackerAlreadyRunningError
  | FellowshipTrackerConfigurationNotFoundError;

export type ActiveTracker = {
  readonly dungeonId: DungeonId;
  readonly fiber: Fiber.Fiber<void, unknown>;
  readonly localLogDungeonRunPersistence:
    | LocalLogDungeonRunPersistence
    | undefined;
  readonly stateRef: Ref.Ref<DungeonRunProcessingState>;
  readonly source: FellowshipTrackerConfigurationSource;
};

export type StartTrackingOptions = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly events: Stream.Stream<FellowshipEvent, unknown>;
  readonly liveStatus?: Stream.Stream<FellowshipLiveStatus, unknown>;
  readonly source: FellowshipTrackerConfigurationSource;
};

export type FellowshipTrackerServiceShape = {
  readonly replayLog: (
    options: ReplayFellowshipTrackerLogOptions,
  ) => E.Effect<void, unknown>;

  readonly start: (
    options: StartFellowshipTrackerOptions,
  ) => E.Effect<void, FellowshipTrackerStartError>;

  readonly startConfiguration: (
    options: StartFellowshipTrackerConfigurationOptions,
  ) => E.Effect<void, FellowshipTrackerAlreadyRunningError>;

  readonly status: E.Effect<FellowshipTrackerStatus>;

  readonly statusChanges: Stream.Stream<FellowshipTrackerStatus>;

  readonly stop: () => E.Effect<void>;
};

export class FellowshipTracker extends Context.Service<
  FellowshipTracker,
  FellowshipTrackerServiceShape
>()(
  "fellowship-run-tracker/application/fellowship-tracker/fellowship-tracker-service/FellowshipTracker",
) {}
