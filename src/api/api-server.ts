import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { AbilitiesApiLive } from "@/api/http/groups/abilities/abilities-api-live.ts";
import { AppSettingsApiLive } from "@/api/http/groups/app-settings/app-settings-live.ts";
import { ConfigurationsApiLive } from "@/api/http/groups/configurations/configurations-api-live.ts";
import { DungeonsApiLive } from "@/api/http/groups/dungeons/dungeons-api-live.ts";
import { EncountersApiLive } from "@/api/http/groups/encounters/encounters-api-live.ts";
import { LiveSplitApiLive } from "@/api/http/groups/live-split/live-split-api-live.ts";
import { TrackingApiLive } from "@/api/http/groups/tracking/tracking-api-live.ts";
import { UnitsApiLive } from "@/api/http/groups/units/units-api-live.ts";
import { AppHttpApi } from "@/api/http/http-api.ts";
import { DungeonRunEventsRoutes } from "@/api/websocket/dungeon-run/dungeon-run-events-route.ts";
import { LiveSplitRoutes } from "@/api/websocket/live-split/live-split-route.ts";
import { TrackingRoutes } from "@/api/websocket/tracking/tracking-route.ts";
import { appConfig } from "@/app-config.ts";

import { DungeonRunsApiLive } from "./http/groups/dungeon-runs/dungeon-runs-api-live.ts";

const CorsLive = Layer.unwrap(
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
  Layer.provide(AbilitiesApiLive),
  Layer.provide(AppSettingsApiLive),
  Layer.provide(ConfigurationsApiLive),
  Layer.provide(DungeonRunsApiLive),
  Layer.provide(DungeonsApiLive),
  Layer.provide(EncountersApiLive),
  Layer.provide(LiveSplitApiLive),
  Layer.provide(TrackingApiLive),
  Layer.provide(UnitsApiLive),
);

const WebsocketRoutes = Layer.mergeAll(
  DungeonRunEventsRoutes,
  LiveSplitRoutes,
  TrackingRoutes,
);

const ApiRoutes = Layer.mergeAll(HttpApiRoutes, WebsocketRoutes).pipe(
  Layer.provide(CorsLive),
);

export const ApiServer = HttpRouter.serve(ApiRoutes);
