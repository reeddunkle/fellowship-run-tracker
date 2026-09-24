import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { type ConfigurationId } from "@frt/shared/configuration/configuration-id-schema.ts";

import {
  ConfigurationEditorSchema,
  type ConfigurationEditorValue,
  type DecodedConfigurationEditorValue,
} from "@/renderer/components/configuration/form/configuration-form-schema.ts";
import {
  type ConfigurationExistingSaveState,
  type ConfigurationSaveState,
} from "@/renderer/components/configuration/form/configuration-save-state.ts";

export type ConfigurationSaveStateResolver = (
  value: DecodedConfigurationEditorValue,
) => ConfigurationSaveState;

export type ConfigurationEditorFormState = {
  readonly isDefaultValue: boolean;
  readonly isDirty: boolean;
  readonly isSubmitted: boolean;
  readonly values: ConfigurationEditorValue;
};

export type ConfigurationPersistenceState =
  | {
      readonly saveState: ConfigurationExistingSaveState;
      readonly shouldWarnAboutOverwrite: true;
      readonly updateConfigurationId: ConfigurationId;
    }
  | {
      readonly saveState: ConfigurationSaveState | undefined;
      readonly shouldWarnAboutOverwrite: false;
      readonly updateConfigurationId: ConfigurationId | null;
    };

function decodeConfigurationEditorValue(
  value: ConfigurationEditorValue,
): DecodedConfigurationEditorValue | undefined {
  const result = Schema.decodeUnknownResult(ConfigurationEditorSchema)(value);

  return Result.match(result, {
    onFailure: () => undefined,
    onSuccess: (decoded) => decoded,
  });
}

export function resolveConfigurationSaveState(
  value: ConfigurationEditorValue,
  getSaveState: ConfigurationSaveStateResolver,
): ConfigurationSaveState | undefined {
  const decoded = decodeConfigurationEditorValue(value);

  if (decoded === undefined) {
    return undefined;
  }

  return getSaveState(decoded);
}

export function selectConfigurationEditorFormState(
  state: ConfigurationEditorFormState,
) {
  return {
    isDefaultValue: state.isDefaultValue,
    isDirty: state.isDirty,
    isSubmitted: state.isSubmitted,
    values: state.values,
  };
}

export function hasUnsavedChanges({
  isDefaultValue,
  isDirty,
  isSubmitted,
}: Pick<
  ConfigurationEditorFormState,
  "isDefaultValue" | "isDirty" | "isSubmitted"
>): boolean {
  if (isDefaultValue) {
    return false;
  }

  if (isSubmitted && !isDirty) {
    return false;
  }

  return true;
}

export function getConfigurationPersistenceState({
  saveState,
  selectedConfigurationId,
}: {
  readonly saveState: ConfigurationSaveState | undefined;
  readonly selectedConfigurationId: ConfigurationId | null;
}): ConfigurationPersistenceState {
  if (
    saveState?.type === "EXISTING" &&
    saveState.configurationId !== selectedConfigurationId
  ) {
    return {
      saveState,
      shouldWarnAboutOverwrite: true,
      updateConfigurationId: saveState.configurationId,
    };
  }

  return {
    saveState,
    shouldWarnAboutOverwrite: false,
    updateConfigurationId:
      saveState?.type === "EXISTING"
        ? saveState.configurationId
        : selectedConfigurationId,
  };
}
