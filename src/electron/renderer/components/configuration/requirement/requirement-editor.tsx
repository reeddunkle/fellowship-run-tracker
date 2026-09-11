import { XIcon } from "lucide-react";

import { useConfigurationEditor } from "@/electron/renderer/components/configuration/configuration-editor-provider.tsx";
import { type ConfigurationFormApi } from "@/electron/renderer/components/configuration/configuration-form.ts";
import { type RequirementLocation } from "@/electron/renderer/components/configuration/helpers/configuration-editor-metadata.ts";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/electron/renderer/components/ui/field.tsx";
import { Input } from "@/electron/renderer/components/ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/electron/renderer/components/ui/native-select.tsx";
import {
  FELLOWSHIP_EVENT,
  type FellowshipEventType,
} from "@/services/fellowship/constants/fellowship-event.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";

import { RequirementTargetField } from "./requirement-target-field.tsx";

const eventTypeToLabel: Partial<Record<FellowshipEventType, string>> = {
  [FELLOWSHIP_EVENT.ABILITY_ACTIVATED]: "Ability Activated",
  [FELLOWSHIP_EVENT.ENCOUNTER_END]: "Boss Kill",
  [FELLOWSHIP_EVENT.ENCOUNTER_START]: "Boss Start",
  [FELLOWSHIP_EVENT.UNIT_DEATH]: "Unit Death",
};

type RequirementEditorProps = {
  readonly autoFocus?: boolean;
  readonly eventTypes: ReadonlyArray<RequirementEventType>;
  readonly form: ConfigurationFormApi;
  readonly milestoneIndex: number;
  readonly onRemove: () => void;
  readonly requirementIndex: number;
};

export function RequirementEditor({
  autoFocus = false,
  eventTypes,
  form,
  milestoneIndex,
  onRemove,
  requirementIndex,
}: RequirementEditorProps) {
  const {
    focusedRequirementMetadata,
    getRequirementValuesForEventType,
    setFocusedRequirement,
  } = useConfigurationEditor();

  const requirementPath =
    `milestones[${milestoneIndex}].requirements[${requirementIndex}]` as const;

  const location = {
    milestoneIndex,
    requirementIndex,
  } satisfies RequirementLocation;

  const requirement =
    form.state.values.milestones[milestoneIndex]?.requirements[
      requirementIndex
    ];

  const matchesFocusedRequirement =
    requirement !== undefined &&
    focusedRequirementMetadata !== undefined &&
    focusedRequirementMetadata.targetId !== "" &&
    requirement.type === focusedRequirementMetadata.eventType &&
    requirement.targetId === focusedRequirementMetadata.targetId;

  const selectableEventTypes = eventTypes.filter((eventType) => {
    return (
      eventType !== FELLOWSHIP_EVENT.DUNGEON_START &&
      eventType !== FELLOWSHIP_EVENT.DUNGEON_END
    );
  });

  const eventTypeOptions = selectableEventTypes.map((eventType) => {
    return {
      label: eventTypeToLabel[eventType] ?? eventType,
      value: eventType,
    };
  });

  return (
    <fieldset
      className="grid gap-4 rounded-lg border bg-muted/30 p-4 transition-[border-color,box-shadow,background-color] data-[matches-focused-requirement=true]:border-primary/60 data-[matches-focused-requirement=true]:bg-primary/5 data-[matches-focused-requirement=true]:ring-2 data-[matches-focused-requirement=true]:ring-primary/20"
      data-matches-focused-requirement={matchesFocusedRequirement}
      onBlurCapture={(event) => {
        const nextFocusedElement = event.relatedTarget;

        if (
          nextFocusedElement instanceof Node &&
          event.currentTarget.contains(nextFocusedElement)
        ) {
          return;
        }

        setFocusedRequirement(undefined);
      }}
      onFocusCapture={() => {
        setFocusedRequirement(location);
      }}
      onPointerDownCapture={() => {
        setFocusedRequirement(location);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name={`${requirementPath}.type` as const}>
          {(field) => {
            const isTypeInvalid = !field.state.meta.isValid;
            const shouldShowTypeError =
              isTypeInvalid && field.state.meta.isBlurred;

            const showOccurrenceFields =
              field.state.value === FELLOWSHIP_EVENT.UNIT_DEATH;

            return (
              <>
                <Field data-invalid={shouldShowTypeError}>
                  <FieldLabel htmlFor={field.name}>Event type</FieldLabel>
                  <NativeSelect
                    aria-invalid={isTypeInvalid}
                    autoFocus={autoFocus}
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      const eventType = event.target
                        .value as RequirementEventType;

                      const requirementValues =
                        getRequirementValuesForEventType({
                          eventType,
                          location,
                        });

                      field.handleChange(eventType);

                      form.setFieldValue(
                        `${requirementPath}.targetId`,
                        requirementValues.targetId,
                      );

                      form.setFieldValue(
                        `${requirementPath}.startOccurrence`,
                        requirementValues.startOccurrence,
                      );

                      form.setFieldValue(
                        `${requirementPath}.requiredCount`,
                        requirementValues.requiredCount,
                      );
                    }}
                    value={field.state.value}
                  >
                    {eventTypeOptions.map(({ value, label }) => {
                      return (
                        <NativeSelectOption key={value} value={value}>
                          {label}
                        </NativeSelectOption>
                      );
                    })}
                  </NativeSelect>
                  {shouldShowTypeError && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
                </Field>
                <RequirementTargetField
                  eventType={field.state.value}
                  form={form}
                  key={field.state.value}
                  location={location}
                  requirementPath={requirementPath}
                />
                {showOccurrenceFields && (
                  <FieldGroup className="gap-2">
                    <FieldTitle>Count</FieldTitle>
                    <FieldGroup className="grid grid-cols-2 gap-3">
                      <form.Field
                        name={`${requirementPath}.startOccurrence` as const}
                      >
                        {(startOccurrenceField) => {
                          const isInvalid =
                            !startOccurrenceField.state.meta.isValid;
                          const showError =
                            isInvalid &&
                            startOccurrenceField.state.meta.isBlurred;

                          return (
                            <Field data-invalid={showError}>
                              <FieldLabel
                                className="text-xs font-normal text-muted-foreground"
                                htmlFor={startOccurrenceField.name}
                              >
                                From
                              </FieldLabel>
                              <Input
                                aria-invalid={isInvalid}
                                id={startOccurrenceField.name}
                                inputMode="numeric"
                                min={1}
                                name={startOccurrenceField.name}
                                onBlur={startOccurrenceField.handleBlur}
                                onChange={(event) => {
                                  startOccurrenceField.handleChange(
                                    event.target.value,
                                  );
                                }}
                                type="number"
                                value={startOccurrenceField.state.value}
                              />

                              {showError && (
                                <FieldError
                                  errors={
                                    startOccurrenceField.state.meta.errors
                                  }
                                />
                              )}
                            </Field>
                          );
                        }}
                      </form.Field>
                      <form.Field
                        name={`${requirementPath}.requiredCount` as const}
                      >
                        {(requiredCountField) => {
                          const isInvalid =
                            !requiredCountField.state.meta.isValid;
                          const showError =
                            isInvalid &&
                            requiredCountField.state.meta.isBlurred;

                          return (
                            <Field data-invalid={showError}>
                              <FieldLabel
                                className="text-xs font-normal text-muted-foreground"
                                htmlFor={requiredCountField.name}
                              >
                                To
                              </FieldLabel>
                              <Input
                                aria-invalid={isInvalid}
                                id={requiredCountField.name}
                                inputMode="numeric"
                                min={1}
                                name={requiredCountField.name}
                                onBlur={requiredCountField.handleBlur}
                                onChange={(event) => {
                                  requiredCountField.handleChange(
                                    event.target.value,
                                  );
                                }}
                                type="number"
                                value={requiredCountField.state.value}
                              />

                              {showError && (
                                <FieldError
                                  errors={requiredCountField.state.meta.errors}
                                />
                              )}
                            </Field>
                          );
                        }}
                      </form.Field>
                    </FieldGroup>
                  </FieldGroup>
                )}
              </>
            );
          }}
        </form.Field>
      </div>
      <div className="flex justify-end">
        <Button
          aria-label="Remove requirement"
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </div>
    </fieldset>
  );
}
