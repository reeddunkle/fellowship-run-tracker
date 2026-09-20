import * as R from "effect/Record";

import {
  serializeCanonicalConfiguration,
  serializeNormalizedCanonicalConfiguration,
} from "@/application/configurations/canonicalize-configuration.ts";
import { saveConfigurationApiRequest } from "@/electron/renderer/components/configuration/form/configuration-editor-adapter.ts";
import { type DecodedConfigurationEditorValue } from "@/electron/renderer/components/configuration/form/configuration-form-schema.ts";
import {
  type ConfigurationApiConfiguration,
  type ConfigurationApiConfigurationList,
} from "@/services/api/configuration/configuration-api-schema.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

type ConfigurationCreateSaveState = {
  readonly type: "CREATE";
};

export type ConfigurationExistingSaveState = {
  readonly configurationId: ConfigurationId;
  readonly label: string;
  readonly type: "EXISTING";
};

export type ConfigurationSaveState =
  | ConfigurationCreateSaveState
  | ConfigurationExistingSaveState;

function getCanonicalJson(
  configuration: ConfigurationApiConfiguration,
): string {
  return serializeNormalizedCanonicalConfiguration({
    dungeonId: configuration.dungeonId,
    dungeonLevel: configuration.dungeonLevel,
    milestones: configuration.milestones,
  });
}

export function makeConfigurationSaveStateLookup(
  configurations: ConfigurationApiConfigurationList,
) {
  const configurationsByCanonicalJson = R.fromIterableBy(
    configurations,
    getCanonicalJson,
  );

  function get(value: DecodedConfigurationEditorValue): ConfigurationSaveState {
    const request = saveConfigurationApiRequest(value);

    const canonicalJson = serializeCanonicalConfiguration(
      request.configuration,
    );

    const existingConfiguration = configurationsByCanonicalJson[canonicalJson];

    if (existingConfiguration === undefined) {
      return {
        type: "CREATE",
      };
    }

    return {
      configurationId: existingConfiguration.id,
      label: existingConfiguration.label,
      type: "EXISTING",
    };
  }

  return {
    get,
  };
}

export type ConfigurationSaveStateLookup = ReturnType<
  typeof makeConfigurationSaveStateLookup
>;
