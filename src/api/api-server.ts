import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { AbilitiesApiLayer } from "@/api/http/groups/abilities/abilities-api-layer.ts";
import { AppSettingsApiLayer } from "@/api/http/groups/app-settings/app-settings-layer.ts";
import { ConfigurationsApiLayer } from "@/api/http/groups/configurations/configurations-api-layer.ts";
import { DungeonRunApiLayer } from "@/api/http/groups/dungeon-run/dungeon-run-api-layer.ts";
import { DungeonsApiLayer } from "@/api/http/groups/dungeons/dungeons-api-layer.ts";
import { EncountersApiLayer } from "@/api/http/groups/encounters/encounters-api-layer.ts";
import { FellowshipLogsApiLayer } from "@/api/http/groups/fellowship-logs/fellowship-logs-api-layer.ts";
import { LiveSplitApiLayer } from "@/api/http/groups/live-split/live-split-api-layer.ts";
import { TrackingApiLayer } from "@/api/http/groups/tracking/tracking-api-layer.ts";
import { UnitsApiLayer } from "@/api/http/groups/units/units-api-layer.ts";
import { AppHttpApi } from "@/api/http/http-api.ts";
import { DungeonRunEventsRoutes } from "@/api/websocket/dungeon-run/dungeon-run-events-route.ts";
import { LiveSplitRoutes } from "@/api/websocket/live-split/live-split-route.ts";
import { TrackingRoutes } from "@/api/websocket/tracking/tracking-route.ts";
import { appConfig } from "@/app-config.ts";

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
  DungeonRunEventsRoutes,
  LiveSplitRoutes,
  TrackingRoutes,
);

const ApiRoutes = Layer.mergeAll(HttpApiRoutes, WebsocketRoutes).pipe(
  Layer.provide(CorsLayer),
);

export const ApiServer = HttpRouter.serve(ApiRoutes);
