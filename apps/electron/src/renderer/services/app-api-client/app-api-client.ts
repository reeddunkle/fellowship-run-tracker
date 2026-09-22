import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

import { getApiBaseUrl } from "@/renderer/services/app-api-client/api-url.ts";

export type AppApiClientShape = HttpApiClient.ForApi<typeof AppHttpApi>;

export class AppApiClient extends Context.Service<
  AppApiClient,
  AppApiClientShape
>()(
  "@frt/electron/renderer/services/app-api-client/app-api-client/AppApiClient",
) {}

const makeAppApiClient = HttpApiClient.make(AppHttpApi, {
  baseUrl: getApiBaseUrl(),
});

export const AppApiClientLayer = Layer.effect(AppApiClient, makeAppApiClient);
