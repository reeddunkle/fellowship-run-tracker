import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { AppHttpApi } from "@/api/http/http-api.ts";
import { getApiBaseUrl } from "@/electron/renderer/services/app-api-client/api-url.ts";

export type AppApiClientShape = HttpApiClient.ForApi<typeof AppHttpApi>;

export class AppApiClient extends Context.Service<
  AppApiClient,
  AppApiClientShape
>()(
  "fellowship-run-tracker/electron/renderer/services/app-api-client/app-api-client/AppApiClient",
) {}

const makeAppApiClient = HttpApiClient.make(AppHttpApi, {
  baseUrl: getApiBaseUrl(),
});

export const AppApiClientLayer = Layer.effect(AppApiClient, makeAppApiClient);
