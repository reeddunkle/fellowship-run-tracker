import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  ConfigurationLibrary,
  type ConfigurationLibraryShape,
} from "@frt/api/services/configuration-library/configuration-library-service.ts";
import { createConfigurationApiResponse } from "@frt/api/services/configuration-library/create-configuration-api-response.ts";
import {
  MOCK_CONFIGURATION_DEFINITION_ID,
  MOCK_CONFIGURATION_FINGERPRINT,
  MOCK_CONFIGURATION_ID,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";

export type MakeConfigurationLibraryMockOptions =
  Partial<ConfigurationLibraryShape>;

const MOCK_CREATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");
const MOCK_UPDATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");

export function makeConfigurationLibraryMock({
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
}: MakeConfigurationLibraryMockOptions = {}) {
  return Layer.succeed(ConfigurationLibrary, {
    delete: deleteConfiguration,
    deleteByDungeonAndLevel,
    getAll,
    getById,
    save,
    saveReplacingDungeonAndLevel,
    update,
  } satisfies ConfigurationLibraryShape);
}

export const ConfigurationLibraryMock = makeConfigurationLibraryMock();
