import * as E from "effect/Effect";

import { type SaveConfigurationApiRequest } from "@frt/shared/configuration/configuration-api-schema.ts";
import { type ConfigurationId } from "@frt/shared/configuration/configuration-id-schema.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

export type ConfigurationIdArgs = {
  readonly id: ConfigurationId;
};

export type SaveConfigurationArgs = {
  readonly request: SaveConfigurationApiRequest;
};

export type UpdateConfigurationArgs = {
  readonly id: ConfigurationId;
  readonly request: SaveConfigurationApiRequest;
};

export const getConfigurations = E.fn(
  "ConfigurationApiClient.getConfigurations",
)(function* () {
  const client = yield* AppApiClient;

  return yield* client.configurations.getConfigurations();
});

export const getConfiguration = E.fn("ConfigurationApiClient.getConfiguration")(
  function* ({ id }: ConfigurationIdArgs) {
    const client = yield* AppApiClient;

    return yield* client.configurations.getConfiguration({
      params: {
        id,
      },
    });
  },
);

export const saveConfiguration = E.fn(
  "ConfigurationApiClient.saveConfiguration",
)(function* ({ request }: SaveConfigurationArgs) {
  const client = yield* AppApiClient;

  return yield* client.configurations.saveConfiguration({
    payload: request,
  });
});

export const updateConfiguration = E.fn(
  "ConfigurationApiClient.updateConfiguration",
)(function* ({ id, request }: UpdateConfigurationArgs) {
  const client = yield* AppApiClient;

  return yield* client.configurations.updateConfiguration({
    params: {
      id,
    },
    payload: request,
  });
});

export const deleteConfiguration = E.fn(
  "ConfigurationApiClient.deleteConfiguration",
)(function* ({ id }: ConfigurationIdArgs) {
  const client = yield* AppApiClient;

  yield* client.configurations.deleteConfiguration({
    params: {
      id,
    },
  });
});
