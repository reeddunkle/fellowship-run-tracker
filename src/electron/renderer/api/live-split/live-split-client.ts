import * as E from "effect/Effect";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { AppHttpApi } from "@/api/http/http-api.ts";
import { getApiBaseUrl } from "@/electron/renderer/api/api-url.ts";

function makeHttpApiClient(baseUrl: string) {
  return HttpApiClient.make(AppHttpApi, {
    baseUrl,
  });
}

export function getLiveSplitConnectionBase(baseUrl: string) {
  return () => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.liveSplit.getLiveSplitConnection();
    });
  };
}

export function connectLiveSplitBase(baseUrl: string) {
  return () => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.liveSplit.connectLiveSplit();
    });
  };
}

export function disconnectLiveSplitBase(baseUrl: string) {
  return () => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.liveSplit.disconnectLiveSplit();
    });
  };
}

export function getLiveSplitConnection() {
  return getLiveSplitConnectionBase(getApiBaseUrl())();
}

export function connectLiveSplit() {
  return connectLiveSplitBase(getApiBaseUrl())();
}

export function disconnectLiveSplit() {
  return disconnectLiveSplitBase(getApiBaseUrl())();
}
