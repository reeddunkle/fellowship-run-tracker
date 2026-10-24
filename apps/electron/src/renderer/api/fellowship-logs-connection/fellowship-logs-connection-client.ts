import * as E from "effect/Effect";

import {
  type FellowshipLogsApiCompleteAuthorizationOptions,
  type FellowshipLogsApiSaveOwnClientOptions,
  type FellowshipLogsApiStartAuthorizationOptions,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client.ts";

export const getConnectionStatus = E.fn(
  "FellowshipLogsConnectionApiClient.getConnectionStatus",
)(function* () {
  const client = yield* AppApiClient;

  return yield* client.fellowshipLogsConnection.getFellowshipLogsConnection();
});

export const startAuthorization = E.fn(
  "FellowshipLogsConnectionApiClient.startAuthorization",
)(function* (options: FellowshipLogsApiStartAuthorizationOptions) {
  const client = yield* AppApiClient;

  return options.profile === "OWN_CLIENT_USER"
    ? yield* client.fellowshipLogsConnection.startFellowshipLogsAuthorization({
        payload: options,
      })
    : yield* client.fellowshipLogsConnection.startFellowshipLogsAuthorization({
        payload: options,
      });
});

export const completeAuthorization = E.fn(
  "FellowshipLogsConnectionApiClient.completeAuthorization",
)(function* (options: FellowshipLogsApiCompleteAuthorizationOptions) {
  const client = yield* AppApiClient;

  return yield* client.fellowshipLogsConnection.completeFellowshipLogsAuthorization(
    { payload: options },
  );
});

export const cancelAuthorization = E.fn(
  "FellowshipLogsConnectionApiClient.cancelAuthorization",
)(function* () {
  const client = yield* AppApiClient;

  yield* client.fellowshipLogsConnection.cancelFellowshipLogsAuthorization();
});

export const saveOwnClient = E.fn(
  "FellowshipLogsConnectionApiClient.saveOwnClient",
)(function* (options: FellowshipLogsApiSaveOwnClientOptions) {
  const client = yield* AppApiClient;

  return yield* client.fellowshipLogsConnection.saveFellowshipLogsOwnClient({
    payload: options,
  });
});

export const disconnect = E.fn("FellowshipLogsConnectionApiClient.disconnect")(
  function* () {
    const client = yield* AppApiClient;

    yield* client.fellowshipLogsConnection.disconnectFellowshipLogs();
  },
);

export const checkPointSystemOptIn = E.fn(
  "FellowshipLogsConnectionApiClient.checkPointSystemOptIn",
)(function* () {
  const client = yield* AppApiClient;

  return yield* client.fellowshipLogsConnection.checkFellowshipLogsPointSystemOptIn();
});
