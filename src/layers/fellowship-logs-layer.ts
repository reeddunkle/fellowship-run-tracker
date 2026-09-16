import * as Layer from "effect/Layer";

import {
  NodeHttpClientLive,
  NodePlatformLive,
} from "@/layers/node-platform-layer.ts";
import { type AppSettings } from "@/services/app-settings/app-settings-service.ts";
import { makeFellowshipLogsFixtureLive } from "@/services/fellowship-logs/fellowship-logs-fixture-live.ts";
import { FELLOWSHIP_LOGS_FIXTURE_DIRECTORY } from "@/services/fellowship-logs/fellowship-logs-fixture-paths.ts";
import { FellowshipLogsLive } from "@/services/fellowship-logs/fellowship-logs-service-live.ts";

const USE_FELLOWSHIP_LOGS_FIXTURES = true;

export function makeFellowshipLogsLayer<ROut, E1, RIn>(
  appSettingsWithDependenciesLive: Layer.Layer<AppSettings | ROut, E1, RIn>,
) {
  if (USE_FELLOWSHIP_LOGS_FIXTURES) {
    return makeFellowshipLogsFixtureLive({
      fixtureDirectory: FELLOWSHIP_LOGS_FIXTURE_DIRECTORY,
    }).pipe(Layer.provide(NodePlatformLive));
  }

  return FellowshipLogsLive.pipe(
    Layer.provide(
      Layer.mergeAll(appSettingsWithDependenciesLive, NodeHttpClientLive),
    ),
  );
}
