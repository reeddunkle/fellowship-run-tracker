import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import {
  CopyPlusIcon,
  HistoryIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/electron/renderer/components/ui/button.tsx";
import { Card, CardContent } from "@/electron/renderer/components/ui/card.tsx";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/electron/renderer/components/ui/field.tsx";
import { Input } from "@/electron/renderer/components/ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/electron/renderer/components/ui/native-select.tsx";
import {
  useConfigurationActions,
  useSelectedConfiguration,
  useSelectedConfigurationId,
} from "@/electron/renderer/stores/configurations-store/configurations-store.tsx";
import {
  useDungeonRunActions,
  useDungeonRunServerState,
} from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

import { ConfigurationEditorProvider } from "./configuration-editor-provider.tsx";
import {
  createMilestoneEditorValue,
  useConfigurationForm,
} from "./configuration-form.ts";
import {
  ConfigurationEditorSchema,
  type ConfigurationEditorValue,
  type DecodedConfigurationEditorValue,
} from "./configuration-form-schema.ts";
import { ConfigurationOverwriteWarning } from "./configuration-save-state-indicator.tsx";
import { type DungeonOption } from "./helpers/configuration-editor-types.ts";
import {
  type ConfigurationExistingSaveState,
  type ConfigurationSaveState,
} from "./helpers/configuration-save-state.ts";
import { MilestoneEditor } from "./milestone/milestone-editor.tsx";

const CONFIGURATION_FORM_DOM_ID = "configuration-form";

const pinnacleOptions = [
  {
    label: "Normal",
    value: "11",
  },
  {
    label: "Hard",
    value: "23",
  },
  {
    label: "Nightmare",
    value: "40",
  },
] as const;

type ConfigurationEditorProps = {
  readonly defaultValue: ConfigurationEditorValue;
  readonly dungeonOptions: ReadonlyArray<DungeonOption>;
  readonly eventTypes: ReadonlyArray<RequirementEventType>;
  readonly getSaveState: (
    value: DecodedConfigurationEditorValue,
  ) => ConfigurationSaveState;
};

type ConfigurationEditorFormState = {
  readonly isDefaultValue: boolean;
  readonly isDirty: boolean;
  readonly isSubmitted: boolean;
  readonly values: ConfigurationEditorValue;
};

type ConfigurationPersistenceState =
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

function selectConfigurationEditorFormState(
  state: ConfigurationEditorFormState,
) {
  return {
    isDefaultValue: state.isDefaultValue,
    isDirty: state.isDirty,
    isSubmitted: state.isSubmitted,
    values: state.values,
  };
}

function hasUnsavedChanges({
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

function getConfigurationPersistenceState({
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

export function ConfigurationEditor({
  defaultValue,
  dungeonOptions,
  eventTypes,
  getSaveState,
}: ConfigurationEditorProps) {
  const selectedConfiguration = useSelectedConfiguration();
  const selectedConfigurationId = useSelectedConfigurationId();

  const { deleteConfiguration, isUpdating, newConfiguration, save, update } =
    useConfigurationActions();

  const { deleteHistoryForConfigurationId } = useDungeonRunActions();
  const { history } = useDungeonRunServerState();

  const form = useConfigurationForm({
    defaultValues: defaultValue,
    onSave: save,
    onUpdate: update,
  });

  const resolveSaveState = (
    value: ConfigurationEditorValue,
  ): ConfigurationSaveState | undefined => {
    const decoded = decodeConfigurationEditorValue(value);

    if (decoded === undefined) {
      return undefined;
    }

    return getSaveState(decoded);
  };

  const hasSelectedConfiguration = selectedConfiguration !== undefined;

  const selectedConfigurationHistory =
    history?.configurationId === selectedConfigurationId ? history : null;

  const historicalSampleCount =
    selectedConfigurationHistory?.observations.reduce(
      (sampleCount, observation) => {
        return sampleCount + observation.sampleCount;
      },
      0,
    ) ?? 0;

  const historicalObservationCount =
    selectedConfigurationHistory?.observations.length ?? 0;

  const hasHistory = historicalSampleCount > 0;

  return (
    <ConfigurationEditorProvider form={form}>
      <section className="grid gap-6">
        <header className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Configure a run
          </h1>
          <p className="text-sm text-muted-foreground">
            Select a saved configuration from the sidebar or create a new one.
          </p>
        </header>
        <section className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <Button onClick={newConfiguration} type="button" variant="outline">
              <PlusIcon />
              New
            </Button>
            <form.Subscribe selector={selectConfigurationEditorFormState}>
              {(state) => {
                const isResetEnabled = hasUnsavedChanges(state);

                return (
                  <Button
                    disabled={!isResetEnabled}
                    onClick={() => {
                      form.reset();
                    }}
                    type="button"
                    variant="outline"
                  >
                    <RotateCcwIcon />
                    Reset
                  </Button>
                );
              }}
            </form.Subscribe>
            <form.Subscribe
              selector={(state) => {
                return {
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                  values: state.values,
                };
              }}
            >
              {({ canSubmit, isSubmitting, values }) => {
                const saveState = resolveSaveState(values);

                const isSaveNewEnabled =
                  canSubmit &&
                  !isSubmitting &&
                  !isUpdating &&
                  saveState?.type === "CREATE";

                return (
                  <Button
                    disabled={!isSaveNewEnabled}
                    onClick={() => {
                      form.handleSubmit({
                        type: "SAVE",
                      });
                    }}
                    type="button"
                    variant="secondary"
                  >
                    <CopyPlusIcon />
                    Save new
                  </Button>
                );
              }}
            </form.Subscribe>
            <form.Subscribe selector={selectConfigurationEditorFormState}>
              {(state) => {
                const persistenceState = getConfigurationPersistenceState({
                  saveState: resolveSaveState(state.values),
                  selectedConfigurationId,
                });

                const hasChanges = hasUnsavedChanges(state);

                const isUpdateEnabled =
                  hasChanges &&
                  persistenceState.saveState !== undefined &&
                  persistenceState.updateConfigurationId !== null;

                const shouldWarn =
                  hasChanges && persistenceState.shouldWarnAboutOverwrite;

                return (
                  <Button
                    className={shouldWarn ? "ring-2 ring-amber-500" : undefined}
                    disabled={!isUpdateEnabled || isUpdating}
                    form={CONFIGURATION_FORM_DOM_ID}
                    type="submit"
                  >
                    <SaveIcon />
                    Update
                  </Button>
                );
              }}
            </form.Subscribe>
            <Button
              disabled={!hasSelectedConfiguration}
              onClick={() => {
                if (selectedConfiguration === undefined) {
                  return;
                }

                deleteConfiguration(selectedConfiguration.id);
              }}
              type="button"
              variant="destructive"
            >
              <Trash2Icon />
              Delete
            </Button>
          </div>
          <form.Subscribe selector={selectConfigurationEditorFormState}>
            {(state) => {
              if (!hasUnsavedChanges(state)) {
                return null;
              }

              const persistenceState = getConfigurationPersistenceState({
                saveState: resolveSaveState(state.values),
                selectedConfigurationId,
              });

              if (!persistenceState.shouldWarnAboutOverwrite) {
                return null;
              }

              return (
                <ConfigurationOverwriteWarning
                  configurationLabel={persistenceState.saveState.label}
                />
              );
            }}
          </form.Subscribe>
        </section>
        <section className="grid max-w-xl gap-3 rounded-lg border p-4">
          <div className="grid gap-1">
            <h2 className="text-sm font-medium">Run history</h2>
            <p className="text-sm text-muted-foreground">
              {selectedConfigurationId === null
                ? "Select a saved configuration to view its historical timing data."
                : hasHistory
                  ? `${historicalSampleCount} historical ${
                      historicalSampleCount === 1 ? "sample" : "samples"
                    } across ${historicalObservationCount} tracked ${
                      historicalObservationCount === 1
                        ? "observation"
                        : "observations"
                    }.`
                  : "No historical timing data is available for this configuration."}
            </p>
          </div>
          {hasHistory ? (
            <div>
              <Button
                disabled={selectedConfigurationId === null || !hasHistory}
                onClick={() => {
                  if (selectedConfigurationId === null) {
                    return;
                  }

                  deleteHistoryForConfigurationId(selectedConfigurationId);
                }}
                type="button"
                variant="outline"
              >
                <HistoryIcon />
                Clear historical times
              </Button>
            </div>
          ) : null}
        </section>
        <form
          className="grid gap-8"
          id={CONFIGURATION_FORM_DOM_ID}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();

            const persistenceState = getConfigurationPersistenceState({
              saveState: resolveSaveState(form.state.values),
              selectedConfigurationId,
            });

            if (persistenceState.updateConfigurationId === null) {
              return;
            }

            form.handleSubmit({
              configurationId: persistenceState.updateConfigurationId,
              type: "UPDATE",
            });
          }}
        >
          <form.Subscribe selector={selectConfigurationEditorFormState}>
            {(state) => {
              const persistenceState = getConfigurationPersistenceState({
                saveState: resolveSaveState(state.values),
                selectedConfigurationId,
              });

              const shouldWarn =
                hasUnsavedChanges(state) &&
                persistenceState.shouldWarnAboutOverwrite;

              const saveStateClassName = shouldWarn
                ? "border-amber-500/70"
                : "border-border";

              return (
                <div
                  className={`grid gap-8 rounded-xl border-2 p-4 transition-colors ${saveStateClassName}`}
                >
                  <div className="grid gap-4">
                    <div className="w-full max-w-lg">
                      <form.Field name="label">
                        {(field) => {
                          const isInvalid =
                            field.state.meta.isBlurred &&
                            !field.state.meta.isValid;

                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                Configuration label
                              </FieldLabel>
                              <Input
                                aria-invalid={isInvalid}
                                id={field.name}
                                name={field.name}
                                onBlur={field.handleBlur}
                                onChange={(event) => {
                                  field.handleChange(event.target.value);
                                }}
                                placeholder="My configuration"
                                value={field.state.value}
                              />
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          );
                        }}
                      </form.Field>
                    </div>
                    <div className="grid justify-start gap-4 md:grid-cols-[minmax(20rem,32rem)_10rem]">
                      <form.Field name="dungeonId">
                        {(field) => {
                          const isInvalid =
                            field.state.meta.isBlurred &&
                            !field.state.meta.isValid;

                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                Dungeon
                              </FieldLabel>
                              <NativeSelect
                                aria-invalid={isInvalid}
                                id={field.name}
                                name={field.name}
                                onBlur={field.handleBlur}
                                onChange={(event) => {
                                  const dungeonId = event.target.value;

                                  field.handleChange(dungeonId);

                                  if (
                                    dungeonId === "30" &&
                                    state.values.dungeonLevel === ""
                                  ) {
                                    form.setFieldValue(
                                      "dungeonLevel",
                                      pinnacleOptions[0].value,
                                    );
                                  }
                                }}
                                value={field.state.value}
                              >
                                <NativeSelectOption disabled value="">
                                  Select a dungeon
                                </NativeSelectOption>
                                {dungeonOptions.map((dungeon) => {
                                  return (
                                    <NativeSelectOption
                                      key={dungeon.key}
                                      value={dungeon.key}
                                    >
                                      {dungeon.label}
                                    </NativeSelectOption>
                                  );
                                })}
                              </NativeSelect>
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          );
                        }}
                      </form.Field>
                      <form.Field name="dungeonLevel">
                        {(field) => {
                          const isInvalid =
                            field.state.meta.isBlurred &&
                            !field.state.meta.isValid;

                          const isPinnacleDungeon =
                            state.values.dungeonId === "30";

                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                Eternal level
                              </FieldLabel>
                              {isPinnacleDungeon ? (
                                <NativeSelect
                                  aria-invalid={isInvalid}
                                  id={field.name}
                                  name={field.name}
                                  onBlur={field.handleBlur}
                                  onChange={(event) => {
                                    field.handleChange(event.target.value);
                                  }}
                                  value={field.state.value}
                                >
                                  {pinnacleOptions.map((option) => {
                                    return (
                                      <NativeSelectOption
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </NativeSelectOption>
                                    );
                                  })}
                                </NativeSelect>
                              ) : (
                                <Input
                                  aria-invalid={isInvalid}
                                  id={field.name}
                                  min={1}
                                  name={field.name}
                                  onBlur={field.handleBlur}
                                  onChange={(event) => {
                                    field.handleChange(event.target.value);
                                  }}
                                  type="number"
                                  value={field.state.value}
                                />
                              )}
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          );
                        }}
                      </form.Field>
                    </div>
                  </div>
                  <form.Field mode="array" name="milestones">
                    {(milestonesField) => {
                      return (
                        <section className="grid grid-cols-[repeat(auto-fit,minmax(22rem,28rem))] justify-start gap-4">
                          {milestonesField.state.value.map(
                            (milestone, milestoneIndex) => {
                              return (
                                <MilestoneEditor
                                  eventTypes={eventTypes}
                                  form={form}
                                  key={milestone.id}
                                  milestoneIndex={milestoneIndex}
                                  onRemove={() => {
                                    milestonesField.removeValue(milestoneIndex);
                                  }}
                                />
                              );
                            },
                          )}
                          <Card className="min-h-64 border-dashed">
                            <CardContent className="flex h-full min-h-64 items-center justify-center">
                              <Button
                                className="h-full min-h-48 w-full border-dashed"
                                onClick={() => {
                                  milestonesField.pushValue(
                                    createMilestoneEditorValue(),
                                  );
                                }}
                                type="button"
                                variant="ghost"
                              >
                                <PlusIcon />
                                Add milestone
                              </Button>
                            </CardContent>
                          </Card>
                        </section>
                      );
                    }}
                  </form.Field>
                </div>
              );
            }}
          </form.Subscribe>
        </form>
      </section>
    </ConfigurationEditorProvider>
  );
}
