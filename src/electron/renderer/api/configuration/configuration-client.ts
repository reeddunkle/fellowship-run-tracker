import * as E from "effect/Effect";

import { AppApiClient } from "@/electron/renderer/services/app-api-client/app-api-client";
import {
  type DeleteConfigurationsByDungeonAndLevelApiRequest,
  type SaveConfigurationApiRequest,
} from "@/services/api/configuration/configuration-api-schema.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

type ConfigurationIdArgs = {
  readonly id: ConfigurationId;
};

export type SaveConfigurationArgs = {
  readonly request: SaveConfigurationApiRequest;
};

export type UpdateConfigurationArgs = {
  readonly id: ConfigurationId;
  readonly request: SaveConfigurationApiRequest;
};

export type DeleteConfigurationsByDungeonAndLevelArgs = {
  readonly request: DeleteConfigurationsByDungeonAndLevelApiRequest;
};

export function getConfigurations() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.configurations.getConfigurations();
  });
}

export function getConfiguration({ id }: ConfigurationIdArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.configurations.getConfiguration({
      params: {
        id,
      },
    });
  });
}

export function saveConfiguration({ request }: SaveConfigurationArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.configurations.saveConfiguration({
      payload: request,
    });
  });
}

export function saveReplacingDungeonAndLevel({
  request,
}: SaveConfigurationArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.configurations.saveReplacingDungeonAndLevel({
      payload: request,
    });
  });
}

export function updateConfiguration({ id, request }: UpdateConfigurationArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.configurations.updateConfiguration({
      params: {
        id,
      },
      payload: request,
    });
  });
}

export function deleteConfiguration({ id }: ConfigurationIdArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    yield* client.configurations.deleteConfiguration({
      params: {
        id,
      },
    });
  });
}

export function deleteConfigurationsByDungeonAndLevel({
  request,
}: DeleteConfigurationsByDungeonAndLevelArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    yield* client.configurations.deleteConfigurationsByDungeonAndLevel({
      payload: request,
    });
  });
}
