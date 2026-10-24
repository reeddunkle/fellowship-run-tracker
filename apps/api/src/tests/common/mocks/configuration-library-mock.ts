import * as Layer from "effect/Layer";

import {
  ConfigurationLibrary,
  type ConfigurationLibraryShape,
} from "@frt/api/services/configuration-library/configuration-library-service.ts";
import { unexpectedEffectCall } from "@frt/api/tests/common/mocks/unexpected-service-call.ts";

export type MakeConfigurationLibraryMockOptions =
  Partial<ConfigurationLibraryShape>;

export function makeConfigurationLibraryMock({
  delete: deleteConfiguration = unexpectedEffectCall(
    "ConfigurationLibrary",
    "delete",
  ),
  deleteByDungeonAndLevel = unexpectedEffectCall(
    "ConfigurationLibrary",
    "deleteByDungeonAndLevel",
  ),
  getAll = unexpectedEffectCall("ConfigurationLibrary", "getAll"),
  getById = unexpectedEffectCall("ConfigurationLibrary", "getById"),
  save = unexpectedEffectCall("ConfigurationLibrary", "save"),
  saveReplacingDungeonAndLevel = unexpectedEffectCall(
    "ConfigurationLibrary",
    "saveReplacingDungeonAndLevel",
  ),
  update = unexpectedEffectCall("ConfigurationLibrary", "update"),
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
