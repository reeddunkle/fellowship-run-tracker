import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import {
  CheckCircle2Icon,
  RefreshCwIcon,
  SaveIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";

import { FellowshipLogsRateLimitData } from "@/electron/renderer/components/fellowship-logs/fellowship-logs-rate-limit-data.tsx";
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
import { useFellowshipLogsStore } from "@/electron/renderer/stores/fellowship-logs-store/use-fellowship-logs-store.ts";
import { type AppSettingsApiUpdate } from "@/services/api/app-settings/app-settings-api-schema.ts";

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
    fellowshipLogsClientId: value.fellowshipLogsClientId,
    ...(value.fellowshipLogsClientSecret === undefined
      ? {}
      : {
          fellowshipLogsClientSecret: value.fellowshipLogsClientSecret,
        }),
    isLiveSplitEnabled: value.isLiveSplitEnabled,
    liveSplitHost: value.liveSplitHost,
    liveSplitPort: value.liveSplitPort,
  };
}

export function SettingsEditor() {
  const { getDirectoryPath, save } = useSettingsActions();
  const { error, isSaving } = useSettingsSaveStatus();
  const appSettings = useAppSettings();

  const {
    isRefreshingRateLimitData,
    rateLimitData,
    refreshRateLimitData,
    refreshRateLimitDataError,
  } = useFellowshipLogsStore();

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
                    {field.state.meta.errors.length > 0 ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : null}
                  </Field>
                );
              }}
            </form.Field>
            <Separator className="@3xl:col-span-2" />
            <FieldGroup className="min-w-0 gap-4">
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
                      <form.Field name="liveSplitPort">
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
            <Separator className="@3xl:col-span-2" />
            <FieldGroup className="col-start-1 min-w-0 gap-4">
              <div>
                <p className="text-sm font-medium">Fellowship Logs</p>
                <p className="text-sm text-muted-foreground">
                  Configure your Fellowship Logs API credentials.
                </p>
              </div>
              <form.Field name="fellowshipLogsClientId">
                {(field) => {
                  return (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Client ID</FieldLabel>
                      <Input
                        autoComplete="off"
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                        }}
                        placeholder="Fellowship Logs client ID"
                        spellCheck={false}
                        value={field.state.value}
                      />
                      {field.state.meta.errors.length > 0 ? (
                        <FieldError errors={field.state.meta.errors} />
                      ) : null}
                    </Field>
                  );
                }}
              </form.Field>
              <form.Field name="fellowshipLogsClientSecret">
                {(field) => {
                  const hasStoredSecret =
                    appSettings.hasFellowshipLogsClientSecret &&
                    field.state.value === "";

                  const willClearStoredSecret =
                    appSettings.hasFellowshipLogsClientSecret &&
                    field.state.value === null;

                  const willReplaceStoredSecret =
                    appSettings.hasFellowshipLogsClientSecret &&
                    typeof field.state.value === "string" &&
                    field.state.value.length > 0;

                  const willChangeStoredSecret =
                    willClearStoredSecret || willReplaceStoredSecret;

                  return (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        Client secret
                      </FieldLabel>
                      <div className="flex items-center gap-2">
                        <Input
                          autoComplete="off"
                          className="min-w-0"
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            const value = event.target.value;

                            field.handleChange(
                              value.length === 0 ? null : value,
                            );
                          }}
                          placeholder={
                            hasStoredSecret
                              ? "•••••••• (saved)"
                              : "Fellowship Logs client secret"
                          }
                          spellCheck={false}
                          type="password"
                          value={field.state.value ?? ""}
                        />
                        {willChangeStoredSecret ? (
                          <Button
                            aria-label="Keep saved client secret"
                            onClick={() => {
                              form.resetField("fellowshipLogsClientSecret");
                            }}
                            type="button"
                            variant="outline"
                          >
                            Undo
                          </Button>
                        ) : appSettings.hasFellowshipLogsClientSecret ? (
                          <Button
                            aria-label="Clear saved client secret"
                            onClick={() => {
                              field.handleChange(null);
                            }}
                            size="icon-sm"
                            title="Clear saved client secret"
                            type="button"
                            variant="destructive"
                          >
                            <Trash2Icon />
                          </Button>
                        ) : null}
                      </div>
                      {hasStoredSecret ? (
                        <p className="text-xs text-muted-foreground">
                          You currently have a secret saved.
                        </p>
                      ) : willClearStoredSecret ? (
                        <p className="text-xs text-destructive">
                          Saving will clear your existing client secret.
                        </p>
                      ) : willReplaceStoredSecret ? (
                        <p className="text-xs text-warning">
                          Saving will update your existing client secret.
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Your client secret is only used to make Fellowship Logs
                        requests on your behalf. It is stored encrypted on your
                        computer.
                      </p>
                      {field.state.meta.errors.length > 0 ? (
                        <FieldError errors={field.state.meta.errors} />
                      ) : null}
                    </Field>
                  );
                }}
              </form.Field>
              <div className="flex items-center gap-3">
                <Button
                  disabled={isRefreshingRateLimitData}
                  onClick={refreshRateLimitData}
                  type="button"
                  variant="outline"
                >
                  <RefreshCwIcon />
                  {isRefreshingRateLimitData ? "Testing..." : "Test connection"}
                </Button>
              </div>
              {refreshRateLimitDataError !== undefined ? (
                <div className="rounded-md border border-destructive p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <XCircleIcon className="size-3.5" />
                    Error
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Failed to connect to Fellowship Logs.
                  </p>
                </div>
              ) : rateLimitData !== null ? (
                <div className="grid gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-500">
                    <CheckCircle2Icon className="size-3.5" />
                    Success
                  </div>
                  <FellowshipLogsRateLimitData
                    className="border-green-600/60 dark:border-green-500/60"
                    rateLimitData={rateLimitData}
                  />
                </div>
              ) : null}
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
