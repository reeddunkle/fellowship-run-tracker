import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { SaveIcon } from "lucide-react";

import { type AppSettingsApiUpdate } from "@frt/shared/app-settings/app-settings-api-schema.ts";
import { StatusText } from "@frt/ui/composites/status-text.tsx";
import { Button } from "@frt/ui/primitives/button.tsx";
import { Card, CardContent } from "@frt/ui/primitives/card.tsx";
import { Checkbox } from "@frt/ui/primitives/checkbox.tsx";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@frt/ui/primitives/field.tsx";
import { DirectoryInput } from "@frt/ui/primitives/file-input.tsx";
import { Input } from "@frt/ui/primitives/input.tsx";
import { Separator } from "@frt/ui/primitives/separator.tsx";

import {
  useAppSettings,
  useSettingsActions,
  useSettingsSaveStatus,
} from "@/renderer/components/providers/settings-provider.tsx";

import { createSettingsFormValue, useSettingsForm } from "./settings-form.ts";
import {
  type DecodedSettingsFormValue,
  SettingsFormSchema,
  type SettingsFormValue,
} from "./settings-form-schema.ts";

const SETTINGS_FORM_DOM_ID = "settings-form";

type SettingsEditorFormState = {
  readonly isDefaultValue: boolean;
  readonly isDirty: boolean;
  readonly isSubmitted: boolean;
  readonly values: SettingsFormValue;
};

function decodeSettingsFormValue(
  value: SettingsFormValue,
): DecodedSettingsFormValue | undefined {
  const result = Schema.decodeResult(SettingsFormSchema)(value);

  return Result.match(result, {
    onFailure: () => undefined,
    onSuccess: (decoded) => decoded,
  });
}

function selectSettingsEditorFormState(state: SettingsEditorFormState) {
  return {
    isDefaultValue: state.isDefaultValue,
    isDirty: state.isDirty,
    isSubmitted: state.isSubmitted,
    values: state.values,
  };
}

function selectIsLiveSplitEnabled(state: SettingsEditorFormState): boolean {
  return state.values.isLiveSplitEnabled;
}

function hasUnsavedChanges({
  isDefaultValue,
  isDirty,
  isSubmitted,
}: Pick<
  SettingsEditorFormState,
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

function createAppSettingsUpdate(
  value: DecodedSettingsFormValue,
): AppSettingsApiUpdate {
  return {
    fellowshipLogDirectory: value.fellowshipLogDirectory,
    isLiveSplitEnabled: value.isLiveSplitEnabled,
    liveSplitHost: value.liveSplitHost,
    liveSplitPort: value.liveSplitPort,
  };
}

export function SettingsEditor() {
  const { getDirectoryPath, save } = useSettingsActions();
  const { error, isSaving } = useSettingsSaveStatus();
  const appSettings = useAppSettings();

  const defaultValues = createSettingsFormValue(appSettings);

  const form = useSettingsForm({
    defaultValues,
    onSave: (value) => {
      save(createAppSettingsUpdate(value));
    },
  });

  return (
    <Card>
      <CardContent>
        <form
          className="@container"
          id={SETTINGS_FORM_DOM_ID}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();

            void form.handleSubmit();
          }}
        >
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 @3xl:grid-cols-2">
            <form.Field name="fellowshipLogDirectory">
              {(field) => {
                return (
                  <Field className="@3xl:col-span-2">
                    <FieldLabel htmlFor={field.name}>
                      Fellowship log directory
                    </FieldLabel>
                    <DirectoryInput
                      getPathForFile={getDirectoryPath}
                      onPathChange={(directoryPath) => {
                        field.handleChange(directoryPath);
                      }}
                      value={field.state.value}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                );
              }}
            </form.Field>
            <Separator className="@3xl:col-span-2" />
            <FieldGroup className="min-w-0">
              <form.Field name="isLiveSplitEnabled">
                {(field) => {
                  return (
                    <Field orientation="horizontal">
                      <Checkbox
                        checked={field.state.value}
                        id={field.name}
                        onCheckedChange={(checked) => {
                          field.handleChange(checked === true);
                        }}
                      />
                      <FieldLabel htmlFor={field.name}>
                        Enable LiveSplit integration
                      </FieldLabel>
                    </Field>
                  );
                }}
              </form.Field>
              <form.Subscribe selector={selectIsLiveSplitEnabled}>
                {(isLiveSplitEnabled) => {
                  return (
                    <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-4">
                      <form.Field name="liveSplitHost">
                        {(field) => {
                          return (
                            <Field>
                              <FieldLabel htmlFor={field.name} variant="group">
                                LiveSplit host
                              </FieldLabel>
                              <Input
                                disabled={!isLiveSplitEnabled}
                                id={field.name}
                                name={field.name}
                                onBlur={field.handleBlur}
                                onChange={(event) => {
                                  field.handleChange(event.target.value);
                                }}
                                placeholder="localhost"
                                value={field.state.value}
                              />
                              <FieldError errors={field.state.meta.errors} />
                            </Field>
                          );
                        }}
                      </form.Field>
                      <form.Field name="liveSplitPort">
                        {(field) => {
                          return (
                            <Field>
                              <FieldLabel htmlFor={field.name} variant="group">
                                LiveSplit port
                              </FieldLabel>
                              <Input
                                disabled={!isLiveSplitEnabled}
                                id={field.name}
                                inputMode="numeric"
                                name={field.name}
                                onBlur={field.handleBlur}
                                onChange={(event) => {
                                  field.handleChange(event.target.value);
                                }}
                                placeholder="16834"
                                value={field.state.value}
                              />
                              <FieldError errors={field.state.meta.errors} />
                            </Field>
                          );
                        }}
                      </form.Field>
                    </div>
                  );
                }}
              </form.Subscribe>
            </FieldGroup>
            <Separator className="@3xl:col-span-2" />
            <form.Subscribe selector={selectSettingsEditorFormState}>
              {({ isDefaultValue, isDirty, isSubmitted, values }) => {
                const decodedValue = decodeSettingsFormValue(values);

                const canSave =
                  decodedValue !== undefined &&
                  hasUnsavedChanges({
                    isDefaultValue,
                    isDirty,
                    isSubmitted,
                  }) &&
                  !isSaving;

                return (
                  <div className="flex items-center gap-3 @3xl:col-span-2">
                    <Button
                      disabled={!canSave}
                      form={SETTINGS_FORM_DOM_ID}
                      type="submit"
                    >
                      <SaveIcon />
                      {isSaving ? "Saving..." : "Save settings"}
                    </Button>
                    {error !== undefined ? (
                      <StatusText variant="destructive">
                        Failed to save settings.
                      </StatusText>
                    ) : null}
                  </div>
                );
              }}
            </form.Subscribe>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
