import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import {
  ConfigurationDAO,
  type ConfigurationDAOShape,
  type PersistedConfiguration,
} from "@/db/daos/configuration/configuration-dao.ts";
import {
  DungeonRunDAO,
  type DungeonRunDAOShape,
} from "@/db/daos/dungeon-run/dungeon-run-dao.ts";
import {
  DungeonRunObservationDAO,
  type DungeonRunObservationDAOShape,
} from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { type DungeonRunModel } from "@/db/models/dungeon-run-model.ts";
import { DungeonRunWebSocketBroadcaster } from "@/services/api/websocket-broadcaster-service.ts";
import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";
import {
  Fellowship,
  type FellowshipService,
} from "@/services/fellowship/fellowship-service.ts";
import {
  LiveSplit,
  type LiveSplitService,
} from "@/services/live-split/core/live-split-service.ts";
import {
  MOCK_CONFIGURATION_DEFINITION_ID,
  MOCK_CONFIGURATION_FINGERPRINT,
  MOCK_CONFIGURATION_ID,
  MOCK_CONFIGURATION_LABEL,
} from "@/tests/common/fixtures/configuration-fixtures.ts";
import { makeFellowshipTrackerTestLayer } from "@/tests/common/layers/fellowship-tracker-test-layer.ts";
import { type ConfigurationDefinitionId } from "@/validation/configuration/configuration-definition-id-schema.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";
import { type ConfigurationLabel } from "@/validation/configuration/configuration-label-schema.ts";
import { DungeonRunIdSchema } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";

import { makeFellowshipTestHarness } from "./fellowship-test-harness.ts";
import { makeWebSocketBroadcasterTestHarness } from "./websocket-broadcaster-test-harness.ts";

type FellowshipLiveEvents = ReturnType<FellowshipService["liveEvents"]>;
type FellowshipLiveStatus = ReturnType<FellowshipService["liveStatus"]>;

type MakeFellowshipTrackerTestHarnessOptions = {
  readonly configuration?: FellowshipMilestoneConfiguration;
  readonly configurationDefinitionId?: ConfigurationDefinitionId;
  readonly configurationId?: ConfigurationId;
  readonly configurationLabel?: ConfigurationLabel;
  readonly handleRunEvent?: LiveSplitService["handleRunEvent"];
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

    const dungeonRunDAO = {
      complete: () => {
        return E.void;
      },
      create: ({ dungeonId, dungeonLevel }) => {
        return E.succeed({
          configurationDefinitionId,
          createdAt: MOCK_CREATED_AT,
          dungeonId,
          dungeonLevel,
          endedAt: null,
          id: MOCK_DUNGEON_RUN_ID,
          startedAt: null,
          status: "ACTIVE",
          updatedAt: MOCK_UPDATED_AT,
        } satisfies DungeonRunModel);
      },
      deleteHistoryByConfigurationDefinitionId: () => {
        return E.void;
      },
      exit: () => {
        return E.void;
      },
      getById: () => {
        return E.succeedNone;
      },
      interrupt: () => {
        return E.void;
      },
      start: () => {
        return E.void;
      },
    } satisfies DungeonRunDAOShape;

    const dungeonRunObservationDAO = {
      getByDungeonRunId: () => {
        return E.succeed([]);
      },
      getHistoryByConfigurationDefinitionId: () => {
        return E.succeed([]);
      },
      observe: () => {
        return E.void;
      },
    } satisfies DungeonRunObservationDAOShape;

    const liveSplit = {
      connect: () => {
        return E.void;
      },
      disconnect: () => {
        return E.void;
      },
      handleRunEvent:
        options.handleRunEvent ??
        (() => {
          return E.void;
        }),
      status: E.succeed({
        _tag: "Disconnected",
      }),
      statusChanges: Stream.make({
        _tag: "Disconnected",
      }),
    } satisfies LiveSplitService;

    const FellowshipTrackerDependenciesTestLive = Layer.mergeAll(
      Layer.succeed(ConfigurationDAO, configurationDAO),
      Layer.succeed(DungeonRunDAO, dungeonRunDAO),
      Layer.succeed(DungeonRunObservationDAO, dungeonRunObservationDAO),
      Layer.succeed(Fellowship, fellowshipHarness.fellowship),
      Layer.succeed(LiveSplit, liveSplit),
      Layer.succeed(
        DungeonRunWebSocketBroadcaster,
        dungeonRunWebSocketBroadcasterHarness.webSocketBroadcaster,
      ),
    );

    const FellowshipTrackerTestLive = makeFellowshipTrackerTestLayer(
      FellowshipTrackerDependenciesTestLive,
    );

    return {
      configuration,
      configurationDefinitionId,
      configurationId,
      configurationLabel,
      dungeonRunWebSocketBroadcasterHarness,
      fellowshipHarness,
      layer: FellowshipTrackerTestLive,
      liveSplit,
      trackingInterrupted,
      trackingStarted,
    };
  });
}
