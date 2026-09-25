import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import type * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import type * as Ref from "effect/Ref";
import type * as Stream from "effect/Stream";

import { DungeonRunWebSocketBroadcaster } from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { type LocalLogDungeonRunPersistence } from "@frt/api/application/dungeon-run-processing/local-log-dungeon-run-persistence.ts";
import {
  type FellowshipTrackerAlreadyRunningError,
  type FellowshipTrackerConfigurationNotFoundError,
} from "@frt/api/errors/fellowship-tracker-error.ts";
import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { type DungeonRunProcessingState } from "@frt/api/services/fellowship/dungeon-runs/dungeon-run-processing-state.ts";
import {
  Fellowship,
  type FellowshipLiveStatus,
} from "@frt/api/services/fellowship/fellowship-service.ts";
import { LiveSplit } from "@frt/api/services/live-split/live-split-service.ts";
import { ConfigurationDAO } from "@frt/db/daos/configuration/configuration-dao.ts";
import { DungeonRunObservationDAO } from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { type ConfigurationDAOError } from "@frt/db/errors/configuration-dao-error.ts";
import { type ConfigurationId } from "@frt/shared/configuration/configuration-id-schema.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";
import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

import { makeFellowshipTracker } from "./make-fellowship-tracker-service.ts";

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
  "@frt/api/application/fellowship-tracker/fellowship-tracker-service/FellowshipTracker",
) {
  static readonly layerNoDeps = Layer.effect(this, makeFellowshipTracker);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(ConfigurationDAO.layer),
    Layer.provide(DungeonRunObservationDAO.layer),
    Layer.provide(DungeonRunRepository.layer),
    Layer.provide(DungeonRunWebSocketBroadcaster.layer),
    Layer.provide(Fellowship.layer),
    Layer.provide(LiveSplit.layer),
  );
}
