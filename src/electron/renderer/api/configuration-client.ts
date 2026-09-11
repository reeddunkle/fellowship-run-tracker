import * as E from "effect/Effect";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { AppHttpApi } from "@/api/http/http-api.ts";
import { getApiBaseUrl } from "@/electron/renderer/api/api-url.ts";
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

function makeHttpApiClient(baseUrl: string) {
  return HttpApiClient.make(AppHttpApi, {
    baseUrl,
  });
}

export function getConfigurationsBase(baseUrl: string) {
  return () => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.configurations.getConfigurations();
    });
  };
}

export function getConfigurationBase(baseUrl: string) {
  return ({ id }: ConfigurationIdArgs) => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.configurations.getConfiguration({
        params: {
          id,
        },
      });
    });
  };
}

export function saveConfigurationBase(baseUrl: string) {
  return ({ request }: SaveConfigurationArgs) => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.configurations.saveConfiguration({
        payload: request,
      });
    });
  };
}

export function saveReplacingDungeonAndLevelBase(baseUrl: string) {
  return ({ request }: SaveConfigurationArgs) => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.configurations.saveReplacingDungeonAndLevel({
        payload: request,
      });
    });
  };
}

export function updateConfigurationBase(baseUrl: string) {
  return ({ id, request }: UpdateConfigurationArgs) => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.configurations.updateConfiguration({
        params: {
          id,
        },
        payload: request,
      });
    });
  };
}

export function deleteConfigurationBase(baseUrl: string) {
  return ({ id }: ConfigurationIdArgs) => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      yield* client.configurations.deleteConfiguration({
        params: {
          id,
        },
      });
    });
  };
}

export function deleteConfigurationsByDungeonAndLevelBase(baseUrl: string) {
  return ({ request }: DeleteConfigurationsByDungeonAndLevelArgs) => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      yield* client.configurations.deleteConfigurationsByDungeonAndLevel({
        payload: request,
      });
    });
  };
}

export function getConfigurations() {
  return getConfigurationsBase(getApiBaseUrl())();
}

// function getConfiguration(args: ConfigurationIdArgs) {
//   return getConfigurationBase(getApiBaseUrl())(args);
// }

export function saveConfiguration(args: SaveConfigurationArgs) {
  return saveConfigurationBase(getApiBaseUrl())(args);
}

export function saveReplacingDungeonAndLevel(args: SaveConfigurationArgs) {
  return saveReplacingDungeonAndLevelBase(getApiBaseUrl())(args);
}

export function updateConfiguration(args: UpdateConfigurationArgs) {
  return updateConfigurationBase(getApiBaseUrl())(args);
}

export function deleteConfiguration(args: ConfigurationIdArgs) {
  return deleteConfigurationBase(getApiBaseUrl())(args);
}

export function deleteConfigurationsByDungeonAndLevel(
  args: DeleteConfigurationsByDungeonAndLevelArgs,
) {
  return deleteConfigurationsByDungeonAndLevelBase(getApiBaseUrl())(args);
}
