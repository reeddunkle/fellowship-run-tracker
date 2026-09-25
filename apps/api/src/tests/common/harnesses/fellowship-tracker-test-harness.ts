import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { DungeonRunWebSocketBroadcaster } from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import {
  DungeonRunRepository,
  type DungeonRunRepositoryShape,
} from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import {
  Fellowship,
  type FellowshipShape,
} from "@frt/api/services/fellowship/fellowship-service.ts";
import {
  LiveSplit,
  type LiveSplitShape,
} from "@frt/api/services/live-split/live-split-service.ts";
import {
  ConfigurationDAO,
  type ConfigurationDAOShape,
  type PersistedConfiguration,
} from "@frt/db/daos/configuration/configuration-dao.ts";
import {
  DungeonRunObservationDAO,
  type DungeonRunObservationDAOShape,
} from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { type DungeonRunModel } from "@frt/db/models/dungeon-run-model.ts";
import {
  MOCK_CONFIGURATION_DEFINITION_ID,
  MOCK_CONFIGURATION_FINGERPRINT,
  MOCK_CONFIGURATION_ID,
  MOCK_CONFIGURATION_LABEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { type ConfigurationDefinitionId } from "@frt/db/validation/configuration/configuration-definition-id-schema.ts";
import { type ConfigurationId } from "@frt/shared/configuration/configuration-id-schema.ts";
import { type ConfigurationLabel } from "@frt/shared/configuration/configuration-label-schema.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";

import { makeFellowshipTestHarness } from "./fellowship-test-harness.ts";
import { makeWebSocketBroadcasterTestHarness } from "./websocket-broadcaster-test-harness.ts";

type FellowshipLiveEvents = ReturnType<FellowshipShape["liveEvents"]>;
type FellowshipLiveStatus = ReturnType<FellowshipShape["liveStatus"]>;

type MakeFellowshipTrackerTestHarnessOptions = {
  readonly configuration?: FellowshipMilestoneConfiguration;
  readonly configurationDefinitionId?: ConfigurationDefinitionId;
  readonly configurationId?: ConfigurationId;
  readonly configurationLabel?: ConfigurationLabel;
  readonly handleRunEvent?: LiveSplitShape["handleRunEvent"];
  readonly liveEvents?: FellowshipLiveEvents;
  readonly liveStatus?: FellowshipLiveStatus;
};

const DEFAULT_CONFIGURATION = {
  dungeonId: "24",
  dungeonLevel: 1,
  milestones: [],
} satisfies FellowshipMilestoneConfiguration;

const MOCK_CREATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");
const MOCK_UPDATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");

const MOCK_DUNGEON_RUN_ID = Schema.decodeSync(DungeonRunIdSchema)(
  "0198d56c-9999-7abc-8def-1234567890ab",
);

export function makeFellowshipTrackerTestHarness(
  options: MakeFellowshipTrackerTestHarnessOptions = {},
) {
  return E.gen(function* () {
    const configurationDefinitionId =
      options.configurationDefinitionId ?? MOCK_CONFIGURATION_DEFINITION_ID;

    const configurationId = options.configurationId ?? MOCK_CONFIGURATION_ID;

    const configuration = options.configuration ?? DEFAULT_CONFIGURATION;

    const configurationLabel =
      options.configurationLabel ?? MOCK_CONFIGURATION_LABEL;

    const persistedConfiguration = {
      configuration,
      configurationDefinitionId,
      createdAt: MOCK_CREATED_AT,
      fingerprint: MOCK_CONFIGURATION_FINGERPRINT,
      id: configurationId,
      label: configurationLabel,
      updatedAt: MOCK_UPDATED_AT,
    } satisfies PersistedConfiguration;

    const trackingStarted = yield* Deferred.make<void>();
    const trackingInterrupted = yield* Deferred.make<void>();

    const defaultLiveEvents = Stream.fromEffect(
      Deferred.succeed(trackingStarted, undefined).pipe(
        E.andThen(E.never),
        E.ensuring(Deferred.succeed(trackingInterrupted, undefined)),
      ),
    );

    const fellowshipHarness = makeFellowshipTestHarness({
      liveEvents: options.liveEvents ?? defaultLiveEvents,
      liveStatus: options.liveStatus ?? Stream.never,
    });

    const dungeonRunWebSocketBroadcasterHarness =
      yield* makeWebSocketBroadcasterTestHarness();

    const configurationDAO = {
      delete: () => {
        return E.void;
      },
      deleteByDungeonAndLevel: () => {
        return E.void;
      },
      getAll: () => {
        return E.succeed([persistedConfiguration]);
      },
      getById: ({ id }) => {
        return id === configurationId
          ? E.succeedSome(persistedConfiguration)
          : E.succeedNone;
      },
      save: () => {
        return E.succeed(persistedConfiguration);
      },
      saveReplacingDungeonAndLevel: () => {
        return E.succeed(persistedConfiguration);
      },
      update: () => {
        return E.succeed(persistedConfiguration);
      },
    } satisfies ConfigurationDAOShape;

    const dungeonRunRepository = {
      completeLocal: () => {
        return E.void;
      },
      createFellowshipLogsDungeonRun: ({
        dungeonId,
        dungeonLevel,
        endedAt,
        isOwnRun,
        startedAt,
      }) => {
        return E.succeed({
          createdAt: MOCK_CREATED_AT,
          dungeonId,
          dungeonLevel,
          endedAt,
          id: MOCK_DUNGEON_RUN_ID,
          isOwnRun,
          source: "FELLOWSHIP_LOGS",
          startedAt,
          updatedAt: MOCK_UPDATED_AT,
        } satisfies DungeonRunModel);
      },
      createLocal: ({ dungeonId, dungeonLevel }) => {
        return E.succeed({
          createdAt: MOCK_CREATED_AT,
          dungeonId,
          dungeonLevel,
          endedAt: null,
          id: MOCK_DUNGEON_RUN_ID,
          isOwnRun: true,
          source: "LOCAL_LOG",
          startedAt: null,
          updatedAt: MOCK_UPDATED_AT,
        } satisfies DungeonRunModel);
      },
      delete: () => {
        return E.void;
      },
      deleteHistory: () => {
        return E.void;
      },
      exitLocal: () => {
        return E.void;
      },
      getFellowshipLogsDungeonRun: () => {
        return E.succeedNone;
      },
      interruptLocal: () => {
        return E.void;
      },
      interruptUnfinishedLocal: () => {
        return E.succeed([]);
      },
      listFellowshipLogsDungeonRuns: () => {
        return E.succeed([]);
      },
      startLocal: () => {
        return E.void;
      },
    } satisfies DungeonRunRepositoryShape;

    const dungeonRunObservationDAO = {
      getByDungeonRunId: () => {
        return E.succeed([]);
      },
      getHistoryByDungeon: () => {
        return E.succeed([]);
      },
      observe: () => {
        return E.void;
      },
    } satisfies DungeonRunObservationDAOShape;

    const liveSplitStatus = {
      status: "Disconnected",
    } as const;

    const liveSplit = {
      connect: () => {
        return E.succeed(liveSplitStatus);
      },
      disconnect: () => {
        return E.succeed(liveSplitStatus);
      },
      getStatus: () => {
        return E.succeed(liveSplitStatus);
      },
      handleRunEvent:
        options.handleRunEvent ??
        (() => {
          return E.void;
        }),
      statusChanges: Stream.make(liveSplitStatus),
    } satisfies LiveSplitShape;

    const FellowshipTrackerDependenciesTestLive = Layer.mergeAll(
      Layer.succeed(ConfigurationDAO, configurationDAO),
      Layer.succeed(DungeonRunObservationDAO, dungeonRunObservationDAO),
      Layer.succeed(DungeonRunRepository, dungeonRunRepository),
      Layer.succeed(Fellowship, fellowshipHarness.fellowship),
      Layer.succeed(LiveSplit, liveSplit),
      Layer.succeed(
        DungeonRunWebSocketBroadcaster,
        dungeonRunWebSocketBroadcasterHarness.webSocketBroadcaster,
      ),
    );

    const FellowshipTrackerTestLive = FellowshipTracker.layerNoDeps.pipe(
      Layer.provide(FellowshipTrackerDependenciesTestLive),
    );

    return {
      configuration,
      configurationDefinitionId,
      configurationId,
      configurationLabel,
      dungeonRunRepository,
      dungeonRunWebSocketBroadcasterHarness,
      fellowshipHarness,
      layer: FellowshipTrackerTestLive,
      liveSplit,
      trackingInterrupted,
      trackingStarted,
    };
  });
}
