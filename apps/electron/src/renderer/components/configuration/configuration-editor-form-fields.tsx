import { PlusIcon } from "lucide-react";

import { type RequirementEventType } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";
import { Button } from "@frt/ui/button.tsx";
import { Card, CardContent } from "@frt/ui/card.tsx";
import { Field, FieldError, FieldLabel } from "@frt/ui/field.tsx";
import { NativeSelect, NativeSelectOption } from "@frt/ui/native-select.tsx";

import {
  type ConfigurationSaveStateResolver,
  getConfigurationPersistenceState,
  hasUnsavedChanges,
  resolveConfigurationSaveState,
  selectConfigurationEditorFormState,
} from "@/renderer/components/configuration/form/configuration-editor-persistence.ts";
import {
  type ConfigurationFormApi,
  createMilestoneEditorValue,
} from "@/renderer/components/configuration/form/configuration-form.ts";
import { type DungeonOption } from "@/renderer/components/configuration/helpers/configuration-editor-types.ts";
import { MilestoneEditor } from "@/renderer/components/configuration/milestone/milestone-editor.tsx";
import { useSelectedConfigurationId } from "@/renderer/stores/configuration/configuration-provider.tsx";

export const CONFIGURATION_FORM_DOM_ID = "configuration-form";

const pinnacleOptions = [
  {
    label: "Normal",
    value: 11,
  },
  {
    label: "Hard",
    value: 23,
  },
  {
    label: "Nightmare",
    value: 40,
  },
] as const;

type ConfigurationEditorFormFieldsProps = {
  readonly dungeonOptions: ReadonlyArray<DungeonOption>;
  readonly eventTypes: ReadonlyArray<RequirementEventType>;
  readonly form: ConfigurationFormApi;
  readonly getSaveState: ConfigurationSaveStateResolver;
};

export function ConfigurationEditorFormFields({
  dungeonOptions,
  eventTypes,
  form,
  getSaveState,
}: ConfigurationEditorFormFieldsProps) {
  const selectedConfigurationId = useSelectedConfigurationId();

  return (
    <form
      className="grid gap-8"
      id={CONFIGURATION_FORM_DOM_ID}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();

        const persistenceState = getConfigurationPersistenceState({
          saveState: resolveConfigurationSaveState(
            form.state.values,
            getSaveState,
          ),
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
            saveState: resolveConfigurationSaveState(
              state.values,
              getSaveState,
            ),
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
                  <form.AppField name="label">
                    {(field) => {
                      return (
                        <field.TextField
                          label="Configuration label"
                          placeholder="My configuration"
                        />
                      );
                    }}
                  </form.AppField>
                </div>
                <div className="grid justify-start gap-4 md:grid-cols-[minmax(20rem,32rem)_10rem]">
                  <form.AppField name="dungeonId">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isBlurred && !field.state.meta.isValid;

                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Dungeon</FieldLabel>
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
                                state.values.dungeonLevel === undefined
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
                          {isInvalid ? (
                            <FieldError errors={field.state.meta.errors} />
                          ) : null}
                        </Field>
                      );
                    }}
                  </form.AppField>
                  <form.AppField name="dungeonLevel">
                    {(field) => {
                      const isPinnacleDungeon = state.values.dungeonId === "30";

                      if (!isPinnacleDungeon) {
                        return (
                          <field.NumberField label="Eternal level" min={1} />
                        );
                      }

                      const isInvalid =
                        field.state.meta.isBlurred && !field.state.meta.isValid;

                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Eternal level
                          </FieldLabel>
                          <NativeSelect
                            aria-invalid={isInvalid}
                            id={field.name}
                            name={field.name}
                            onBlur={field.handleBlur}
                            onChange={(event) => {
                              field.handleChange(Number(event.target.value));
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
                          {isInvalid ? (
                            <FieldError errors={field.state.meta.errors} />
                          ) : null}
                        </Field>
                      );
                    }}
                  </form.AppField>
                </div>
              </div>
              <form.AppField mode="array" name="milestones">
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
              </form.AppField>
            </div>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
