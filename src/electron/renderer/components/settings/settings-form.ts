import { useForm } from "@tanstack/react-form";
import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import { type AppSettingsApiAppSettings } from "@/contracts/app-settings/app-settings-api-schema.ts";

import {
  type DecodedSettingsFormValue,
  SettingsFormSchema,
  SettingsFormStandardSchema,
  type SettingsFormValue,
} from "./settings-form-schema.ts";

type UseSettingsFormOptions = {
  readonly defaultValues: SettingsFormValue;
  readonly onSave: (value: DecodedSettingsFormValue) => void | Promise<void>;
};

export function createSettingsFormValue(
  appSettings: AppSettingsApiAppSettings,
): SettingsFormValue {
  return {
    fellowshipLogDirectory: appSettings.fellowshipLogDirectory,
    fellowshipLogsClientId: appSettings.fellowshipLogsClientId ?? "",
    fellowshipLogsClientSecret: "",
    isLiveSplitEnabled: appSettings.isLiveSplitEnabled,
    liveSplitHost: appSettings.liveSplitHost,
    liveSplitPort: String(appSettings.liveSplitPort),
  };
}

export function useSettingsForm({
  defaultValues,
  onSave,
}: UseSettingsFormOptions) {
  return useForm({
    defaultValues,

    onSubmit: ({ value }) => {
      return E.gen(function* () {
        const decoded = yield* Schema.decodeEffect(SettingsFormSchema)(value);

        yield* E.promise(() => {
          return Promise.resolve(onSave(decoded));
        });
      }).pipe(E.runPromise);
    },

    validators: {
      onChange: SettingsFormStandardSchema,
      onSubmit: SettingsFormStandardSchema,
    },
  });
}

export type SettingsFormApi = ReturnType<typeof useSettingsForm>;
