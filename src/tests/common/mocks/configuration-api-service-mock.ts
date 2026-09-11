import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  ConfigurationApiService,
  type ConfigurationApiServiceShape,
} from "@/services/api/configuration/configuration-api-service.ts";
import { createConfigurationApiResponse } from "@/services/api/configuration/create-configuration-api-response.ts";
import {
  MOCK_CONFIGURATION_DEFINITION_ID,
  MOCK_CONFIGURATION_FINGERPRINT,
  MOCK_CONFIGURATION_ID,
} from "@/tests/common/fixtures/configuration-fixtures.ts";

export type MakeConfigurationApiServiceMockOptions =
  Partial<ConfigurationApiServiceShape>;

const MOCK_CREATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");
const MOCK_UPDATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");

export function makeConfigurationApiServiceMock({
  delete: deleteConfiguration = () => {
    return E.void;
  },
  deleteByDungeonAndLevel = () => {
    return E.void;
  },
  getAll = () => {
    return E.succeed([]);
  },
  getById = () => {
    return E.succeedNone;
  },
  save = ({ configuration, label }) => {
    return E.succeed(
      createConfigurationApiResponse({
        configuration,
        configurationDefinitionId: MOCK_CONFIGURATION_DEFINITION_ID,
        createdAt: MOCK_CREATED_AT,
        fingerprint: MOCK_CONFIGURATION_FINGERPRINT,
        id: MOCK_CONFIGURATION_ID,
        label,
        updatedAt: MOCK_UPDATED_AT,
      }),
    );
  },
  saveReplacingDungeonAndLevel = ({ configuration, label }) => {
    return E.succeed(
      createConfigurationApiResponse({
        configuration,
        configurationDefinitionId: MOCK_CONFIGURATION_DEFINITION_ID,
        createdAt: MOCK_CREATED_AT,
        fingerprint: MOCK_CONFIGURATION_FINGERPRINT,
        id: MOCK_CONFIGURATION_ID,
        label,
        updatedAt: MOCK_UPDATED_AT,
      }),
    );
  },
  update = ({ configuration, id, label }) => {
    return E.succeed(
      createConfigurationApiResponse({
        configuration,
        configurationDefinitionId: MOCK_CONFIGURATION_DEFINITION_ID,
        createdAt: MOCK_CREATED_AT,
        fingerprint: MOCK_CONFIGURATION_FINGERPRINT,
        id,
        label,
        updatedAt: MOCK_UPDATED_AT,
      }),
    );
  },
}: MakeConfigurationApiServiceMockOptions = {}) {
  return Layer.succeed(ConfigurationApiService, {
    delete: deleteConfiguration,
    deleteByDungeonAndLevel,
    getAll,
    getById,
    save,
    saveReplacingDungeonAndLevel,
    update,
  } satisfies ConfigurationApiServiceShape);
}

export const ConfigurationApiServiceMock = makeConfigurationApiServiceMock();
