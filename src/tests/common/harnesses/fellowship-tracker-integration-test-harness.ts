import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import { FellowshipTrackerLive } from "@/application/fellowship-tracker/fellowship-tracker-service-live.ts";
import { FellowshipServicesLive } from "@/layers/fellowship-layer.ts";
import { DungeonRunWebSocketBroadcaster } from "@/services/api/websocket-broadcaster-service.ts";
import { AppSettingsLive } from "@/services/app-settings/app-settings-service.ts";
import { Encryption } from "@/services/encryption/encryption-service.ts";
import {
  LiveSplitConnectionManager,
  type LiveSplitConnectionManagerService,
} from "@/services/live-split/core/live-split-connection-manager-service.ts";
import { LiveSplitLive } from "@/services/live-split/core/live-split-service.ts";
import { makeEncryptionHarness } from "@/tests/common/harnesses/encryption-harness.ts";
import { makePersistenceTestLayer } from "@/tests/common/layers/persistence-test-layer.ts";

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

    const AppSettingsTestLive = AppSettingsLive.pipe(
      Layer.provide(Layer.mergeAll(PersistenceTestLive, EncryptionTestLive)),
    );

    const FellowshipTestLive = FellowshipServicesLive.pipe(
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

    const LiveSplitTestLive = LiveSplitLive.pipe(
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

    const FellowshipTrackerTestLive = FellowshipTrackerLive.pipe(
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
