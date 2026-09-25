import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { AbilitiesApiLayer } from "@frt/api/api/http/groups/abilities/abilities-api-layer.ts";
import { AppSettingsApiLayer } from "@frt/api/api/http/groups/app-settings/app-settings-api-layer.ts";
import { BackgroundJobApiLayer } from "@frt/api/api/http/groups/background-job/background-job-api-layer.ts";
import { ConfigurationsApiLayer } from "@frt/api/api/http/groups/configurations/configurations-api-layer.ts";
import { DungeonRunApiLayer } from "@frt/api/api/http/groups/dungeon-run/dungeon-run-api-layer.ts";
import { DungeonsApiLayer } from "@frt/api/api/http/groups/dungeons/dungeons-api-layer.ts";
import { EncountersApiLayer } from "@frt/api/api/http/groups/encounters/encounters-api-layer.ts";
import { FellowshipLogsApiLayer } from "@frt/api/api/http/groups/fellowship-logs/fellowship-logs-api-layer.ts";
import { LiveSplitApiLayer } from "@frt/api/api/http/groups/live-split/live-split-api-layer.ts";
import { TrackingApiLayer } from "@frt/api/api/http/groups/tracking/tracking-api-layer.ts";
import { UnitsApiLayer } from "@frt/api/api/http/groups/units/units-api-layer.ts";
import { BackgroundJobRoutes } from "@frt/api/api/websocket/background-job/background-job-events-route.ts";
import { DungeonRunEventsRoutes } from "@frt/api/api/websocket/dungeon-run/dungeon-run-events-route.ts";
import { LiveSplitRoutes } from "@frt/api/api/websocket/live-split/live-split-route.ts";
import { TrackingRoutes } from "@frt/api/api/websocket/tracking/tracking-route.ts";
import { appConfig } from "@frt/api/app-config.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

const CorsLayer = Layer.unwrap(
  E.all({
    host: appConfig.electronRendererHost,
    port: appConfig.electronRendererPort,
  }).pipe(
    E.map(({ host, port }) => {
      return HttpRouter.cors({
        allowedOrigins: [`http://${host}:${port}`],
      });
    }),
  ),
);

const HttpApiRoutes = HttpApiBuilder.layer(AppHttpApi).pipe(
  Layer.provide(AbilitiesApiLayer),
  Layer.provide(AppSettingsApiLayer),
  Layer.provide(BackgroundJobApiLayer),
  Layer.provide(ConfigurationsApiLayer),
  Layer.provide(DungeonRunApiLayer),
  Layer.provide(DungeonsApiLayer),
  Layer.provide(EncountersApiLayer),
  Layer.provide(FellowshipLogsApiLayer),
  Layer.provide(LiveSplitApiLayer),
  Layer.provide(TrackingApiLayer),
  Layer.provide(UnitsApiLayer),
);

const WebsocketRoutes = Layer.mergeAll(
  BackgroundJobRoutes,
  DungeonRunEventsRoutes,
  LiveSplitRoutes,
  TrackingRoutes,
);

const ApiRoutes = Layer.mergeAll(HttpApiRoutes, WebsocketRoutes).pipe(
  Layer.provide(CorsLayer),
);

export const ApiServer = HttpRouter.serve(ApiRoutes);
