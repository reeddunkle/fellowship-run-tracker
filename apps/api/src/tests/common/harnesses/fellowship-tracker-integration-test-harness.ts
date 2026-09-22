import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { DungeonRunWebSocketBroadcaster } from "@frt/api/services/api/websocket-broadcaster-service.ts";
import { AppSettings } from "@frt/api/services/app-settings/app-settings-service.ts";
import { Encryption } from "@frt/api/services/encryption/encryption-service.ts";
import { Fellowship } from "@frt/api/services/fellowship/fellowship-service.ts";
import { FileMonitor } from "@frt/api/services/filesystem/file-monitor-service.ts";
import { FileMonitorSource } from "@frt/api/services/filesystem/file-monitor-source-service.ts";
import {
  LiveSplitConnectionManager,
  type LiveSplitConnectionManagerService,
} from "@frt/api/services/live-split/core/live-split-connection-manager-service.ts";
import { LiveSplit } from "@frt/api/services/live-split/core/live-split-service.ts";
import { makeEncryptionHarness } from "@frt/api/tests/common/harnesses/encryption-harness.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";

import { makeLiveSplitTestHarness } from "./live-split-test-harness.ts";
import { makeWebSocketBroadcasterTestHarness } from "./websocket-broadcaster-test-harness.ts";

export type MakeFellowshipTrackerIntegrationTestHarnessOptions = {
  readonly databaseFilename?: string;
};

export function makeFellowshipTrackerIntegrationTestHarness({
  databaseFilename = ":memory:",
}: MakeFellowshipTrackerIntegrationTestHarnessOptions = {}) {
  return E.gen(function* () {
    const encryptionHarness = yield* makeEncryptionHarness();

    const liveSplitHarness = yield* makeLiveSplitTestHarness();

    const dungeonRunWebSocketBroadcasterHarness =
      yield* makeWebSocketBroadcasterTestHarness();

    const PersistenceTestLive = makePersistenceTestLayer(databaseFilename);

    const EncryptionTestLive = Layer.succeed(
      Encryption,
      encryptionHarness.encryption,
    );

    const AppSettingsTestLive = AppSettings.layerNoDeps.pipe(
      Layer.provide(Layer.mergeAll(PersistenceTestLive, EncryptionTestLive)),
    );

    const FellowshipTestLive = Fellowship.layerNoDeps.pipe(
      Layer.provide(Layer.mergeAll(FileMonitor.layer, FileMonitorSource.layer)),
      Layer.provide(AppSettingsTestLive),
    );

    const LiveSplitConnectionManagerTestLive = Layer.succeed(
      LiveSplitConnectionManager,
      {
        client: E.succeedSome(liveSplitHarness.client),
        connect: () => {
          return E.void;
        },
        disconnect: () => {
          return E.void;
        },
        status: E.succeed({
          _tag: "Connected",
        }),
        statusChanges: Stream.make({
          _tag: "Connected",
        }),
      } satisfies LiveSplitConnectionManagerService,
    );

    const LiveSplitTestLive = LiveSplit.layerNoDeps.pipe(
      Layer.provide(LiveSplitConnectionManagerTestLive),
    );

    const DungeonRunWebSocketBroadcasterTestLive = Layer.succeed(
      DungeonRunWebSocketBroadcaster,
      dungeonRunWebSocketBroadcasterHarness.webSocketBroadcaster,
    );

    const FellowshipTrackerDependenciesTestLive = Layer.mergeAll(
      PersistenceTestLive,
      FellowshipTestLive,
      LiveSplitTestLive,
      DungeonRunWebSocketBroadcasterTestLive,
    );

    const FellowshipTrackerTestLive = FellowshipTracker.layerNoDeps.pipe(
      Layer.provide(FellowshipTrackerDependenciesTestLive),
    );

    const layer = Layer.mergeAll(
      PersistenceTestLive,
      EncryptionTestLive,
      AppSettingsTestLive,
      FellowshipTestLive,
      LiveSplitConnectionManagerTestLive,
      LiveSplitTestLive,
      DungeonRunWebSocketBroadcasterTestLive,
      FellowshipTrackerTestLive,
    );

    return {
      dungeonRunWebSocketBroadcasterHarness,
      encryptionHarness,
      layer,
      liveSplitHarness,
    };
  });
}
