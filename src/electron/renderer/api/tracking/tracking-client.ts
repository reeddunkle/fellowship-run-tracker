import * as E from "effect/Effect";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { AppHttpApi } from "@/api/http/http-api.ts";
import { type StartTrackingApiRequest } from "@/application/fellowship-tracker/tracking-api-schema.ts";
import { getApiBaseUrl } from "@/electron/renderer/api/api-url.ts";

function makeHttpApiClient(baseUrl: string) {
  return HttpApiClient.make(AppHttpApi, {
    baseUrl,
  });
}

export function getTrackingBase(baseUrl: string) {
  return () => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.tracking.getTracking();
    });
  };
}

export function startTrackingBase(baseUrl: string) {
  return (request: StartTrackingApiRequest) => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.tracking.startTracking({
        payload: request,
      });
    });
  };
}

export function stopTrackingBase(baseUrl: string) {
  return () => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.tracking.stopTracking();
    });
  };
}

export function getTracking() {
  return getTrackingBase(getApiBaseUrl())();
}

export function startTracking(request: StartTrackingApiRequest) {
  return startTrackingBase(getApiBaseUrl())(request);
}

export function stopTracking() {
  return stopTrackingBase(getApiBaseUrl())();
}
