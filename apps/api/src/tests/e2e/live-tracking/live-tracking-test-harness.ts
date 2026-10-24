import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Queue from "effect/Queue";
import * as Schema from "effect/Schema";

import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { ApiServicesLayer } from "@frt/api/layers/api-services-layer.ts";
import { AppSettingsStore } from "@frt/api/services/app-settings-store/app-settings-store-service.ts";
import { EncryptionKeyDirectory } from "@frt/api/services/encryption/encryption-key-directory.ts";
import { replayFellowshipLogFile } from "@frt/api/services/fellowship/utilities/replay-fellowship-log-file.ts";
import { getBaseUrl } from "@frt/api/tests/common/get-base-url.ts";
import { makeApiServerTestLayer } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import {
  collectWebSocketMessages,
  getWebSocketUrl,
  openWebSocket,
  waitForWebSocketOpen,
} from "@frt/api/tests/common/websocket-test-client.ts";
import { type TrackingApiStatus } from "@frt/api-contract/application/fellowship-tracker/tracking-api-schema.ts";
import { ROUTES } from "@frt/api-contract/constants/routes.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import {
  type DungeonRunApiMessage,
  DungeonRunApiMessageSchema,
} from "@frt/api-contract/websocket/dungeon-run/dungeon-run-api-message-schema.ts";
import { TrackingApiMessageSchema } from "@frt/api-contract/websocket/tracking/tracking-api-message-schema.ts";
import { ConfigurationDAO } from "@frt/db/daos/configuration/configuration-dao.ts";
import { FellowshipLogDirectorySchema } from "@frt/shared/app-settings/app-settings-schema.ts";
import { type ConfigurationLabel } from "@frt/shared/configuration/configuration-label-schema.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";

const LIVE_LOG_FILE_NAME = "CombatLog-live-tracking-test.txt";
const WEBSOCKET_OPEN_TIMEOUT = "1 second";

const LIVE_REPLAY_OPTIONS = {
  batchIntervalMilliseconds: 10,
  maxDelayMilliseconds: 50,
  speed: 200,
} as const;

export type LiveTrackingScenario = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly label: ConfigurationLabel;
  readonly logFilePath: string;
};

const decodeDungeonRunMessage = Schema.decodeUnknownEffect(
  Schema.fromJsonString(DungeonRunApiMessageSchema),
);

const decodeTrackingMessage = Schema.decodeUnknownEffect(
  Schema.fromJsonString(TrackingApiMessageSchema),
);

export const makeLiveTrackingTestHarness = E.fnUntraced(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const directory = yield* fileSystem.makeTempDirectoryScoped();
  const logDirectory = path.join(directory, "logs");

  yield* fileSystem.makeDirectory(logDirectory);

  const LiveTrackingServicesLayer = Layer.mergeAll(
    ApiServicesLayer,
    AppSettingsStore.layer,
    FellowshipTracker.layer,
  ).pipe(
    Layer.provideMerge(
      makePersistenceTestLayer(path.join(directory, "database.db")),
    ),
    Layer.provide(
      Layer.succeed(EncryptionKeyDirectory, path.join(directory, "security")),
    ),
  );

  const layer = Layer.mergeAll(
    makeApiServerTestLayer(LiveTrackingServicesLayer),
    LiveTrackingServicesLayer,
    FetchHttpClient.layer,
  );

  return { layer, logDirectory };
});

export const seedLiveTrackingScenario = E.fnUntraced(function* ({
  logDirectory,
  scenario,
}: {
  readonly logDirectory: string;
  readonly scenario: LiveTrackingScenario;
}) {
  const appSettingsStore = yield* AppSettingsStore;
  const configurationDAO = yield* ConfigurationDAO;

  const appSettings = yield* appSettingsStore.get();

  yield* appSettingsStore.set({
    ...appSettings,
    fellowshipLogDirectory: yield* Schema.decodeEffect(
      FellowshipLogDirectorySchema,
    )(logDirectory),
    isLiveSplitEnabled: false,
  });

  const persistedConfiguration = yield* configurationDAO.save({
    configuration: scenario.configuration,
    label: scenario.label,
  });

  return persistedConfiguration.id;
});

export const makeApiClient = E.fnUntraced(function* () {
  const httpServer = yield* HttpServer.HttpServer;

  return yield* HttpApiClient.make(AppHttpApi, {
    baseUrl: getBaseUrl(httpServer.address),
  });
});

const openWebSocketMessages = E.fnUntraced(function* (route: string) {
  const httpServer = yield* HttpServer.HttpServer;

  const websocket = yield* openWebSocket(
    getWebSocketUrl({ httpServer, route }),
  );

  const messages = yield* collectWebSocketMessages(websocket);

  yield* waitForWebSocketOpen(websocket).pipe(
    E.timeout(WEBSOCKET_OPEN_TIMEOUT),
  );

  return messages;
});

export const openDungeonRunMessages = E.fnUntraced(function* () {
  const messages = yield* openWebSocketMessages(ROUTES.dungeonRunEvents);

  const take = Queue.take(messages).pipe(E.flatMap(decodeDungeonRunMessage));

  const takeUntil = (
    predicate: (message: DungeonRunApiMessage) => boolean,
  ): E.Effect<DungeonRunApiMessage, Schema.SchemaError> => {
    return take.pipe(
      E.filterOrElse(predicate, () => {
        return takeUntil(predicate);
      }),
    );
  };

  return { take, takeUntil };
});

export const awaitTrackingStatus = E.fnUntraced(function* (
  status: TrackingApiStatus["status"],
) {
  const messages = yield* openWebSocketMessages(ROUTES.trackingEvents);

  const takeUntilStatus: E.Effect<TrackingApiStatus, Schema.SchemaError> =
    Queue.take(messages).pipe(
      E.flatMap(decodeTrackingMessage),
      E.map((message) => {
        return message.status;
      }),
      E.filterOrElse(
        (trackingStatus) => {
          return trackingStatus.status === status;
        },
        () => {
          return takeUntilStatus;
        },
      ),
    );

  return yield* takeUntilStatus;
});

export const replayScenarioLog = E.fnUntraced(function* ({
  logDirectory,
  scenario,
}: {
  readonly logDirectory: string;
  readonly scenario: LiveTrackingScenario;
}) {
  const path = yield* Path.Path;

  yield* replayFellowshipLogFile({
    ...LIVE_REPLAY_OPTIONS,
    initialDelayMilliseconds: 0,
    inputFilePath: scenario.logFilePath,
    outputFilePath: path.join(logDirectory, LIVE_LOG_FILE_NAME),
  });
});
