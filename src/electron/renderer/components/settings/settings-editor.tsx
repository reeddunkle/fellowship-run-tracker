import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { SaveIcon } from "lucide-react";

import {
  useAppSettings,
  useSettingsActions,
  useSettingsSaveStatus,
} from "@/electron/renderer/components/providers/settings-provider.tsx";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import { Card, CardContent } from "@/electron/renderer/components/ui/card.tsx";
import { Checkbox } from "@/electron/renderer/components/ui/checkbox.tsx";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/electron/renderer/components/ui/field.tsx";
import { DirectoryInput } from "@/electron/renderer/components/ui/file-input.tsx";
import { Input } from "@/electron/renderer/components/ui/input.tsx";
import { Separator } from "@/electron/renderer/components/ui/separator.tsx";

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

export function SettingsEditor() {
  const { getDirectoryPath, save } = useSettingsActions();
  const { error, isSaving } = useSettingsSaveStatus();
  const appSettings = useAppSettings();

  const defaultValues = createSettingsFormValue(appSettings);

  const form = useSettingsForm({
    defaultValues,
    onSave: (value) => {
      save(value);
    },
  });

  return (
    <Card>
      <CardContent>
        <form
          id={SETTINGS_FORM_DOM_ID}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();

            void form.handleSubmit();
          }}
        >
          <div className="grid gap-6">
            <form.Field name="fellowshipLogDirectory">
              {(field) => {
                return (
                  <Field>
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
                    {field.state.meta.errors.length > 0 ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : null}
                  </Field>
                );
              }}
            </form.Field>
            <Separator />
            <FieldGroup className="gap-4">
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
                    <div className="grid grid-cols-[14rem_8rem] gap-4">
                      <form.Field name="liveSplitsHost">
                        {(field) => {
                          return (
                            <Field>
                              <FieldLabel
                                className="text-xs font-normal text-muted-foreground"
                                htmlFor={field.name}
                              >
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
                              {field.state.meta.errors.length > 0 ? (
                                <FieldError errors={field.state.meta.errors} />
                              ) : null}
                            </Field>
                          );
                        }}
                      </form.Field>
                      <form.Field name="liveSplitsPort">
                        {(field) => {
                          return (
                            <Field>
                              <FieldLabel
                                className="text-xs font-normal text-muted-foreground"
                                htmlFor={field.name}
                              >
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
                              {field.state.meta.errors.length > 0 ? (
                                <FieldError errors={field.state.meta.errors} />
                              ) : null}
                            </Field>
                          );
                        }}
                      </form.Field>
                    </div>
                  );
                }}
              </form.Subscribe>
            </FieldGroup>
            <Separator />
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
                  <div className="flex items-center gap-3">
                    <Button
                      disabled={!canSave}
                      form={SETTINGS_FORM_DOM_ID}
                      type="submit"
                    >
                      <SaveIcon />
                      {isSaving ? "Saving..." : "Save settings"}
                    </Button>
                    {error !== undefined ? (
                      <p className="text-destructive text-sm">
                        Failed to save settings.
                      </p>
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
