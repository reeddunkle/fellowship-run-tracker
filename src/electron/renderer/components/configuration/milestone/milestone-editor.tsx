import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { useConfigurationEditor } from "@/electron/renderer/components/configuration/configuration-editor-provider.tsx";
import {
  type ConfigurationFormApi,
  createRequirementEditorValue,
} from "@/electron/renderer/components/configuration/configuration-form.ts";
import { RequirementEditor } from "@/electron/renderer/components/configuration/requirement/requirement-editor.tsx";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/electron/renderer/components/ui/card.tsx";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/electron/renderer/components/ui/field.tsx";
import { Input } from "@/electron/renderer/components/ui/input.tsx";
import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";

type MilestoneEditorProps = {
  readonly eventTypes: ReadonlyArray<RequirementEventType>;
  readonly form: ConfigurationFormApi;
  readonly milestoneIndex: number;
  readonly onRemove: () => void;
};

export function MilestoneEditor({
  eventTypes,
  form,
  milestoneIndex,
  onRemove,
}: MilestoneEditorProps) {
  const [autoFocusRequirementId, setAutoFocusRequirementId] = useState<
    string | undefined
  >();

  const { getRequirementValuesForEventType } = useConfigurationEditor();

  const milestonePath = `milestones[${milestoneIndex}]` as const;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Milestone</CardTitle>
        <CardAction>
          <Button
            aria-label="Remove milestone"
            onClick={onRemove}
            size="icon-sm"
            type="button"
            variant="destructive"
          >
            <Trash2Icon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex gap-3">
          <form.Field name={`${milestonePath}.label` as const}>
            {(field) => {
              const isInvalid =
                field.state.meta.isBlurred && !field.state.meta.isValid;

              return (
                <Field className="min-w-0 flex-1" data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Label</FieldLabel>
                  <Input
                    aria-invalid={isInvalid}
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    placeholder="Milestone label"
                    value={field.state.value}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>

          <form.Field name={`${milestonePath}.comparisonTime` as const}>
            {(field) => {
              const isInvalid =
                field.state.meta.isBlurred && !field.state.meta.isValid;

              return (
                <Field className="w-fit" data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>
                    Goal time (optional)
                  </FieldLabel>
                  <Input
                    aria-invalid={isInvalid}
                    className="field-sizing-content"
                    id={field.name}
                    inputMode="text"
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    placeholder="1:15 or 1.25"
                    value={field.state.value}
                  />
                  {isInvalid && (
                    <FieldError
                      className="whitespace-normal contain-[inline-size]"
                      errors={field.state.meta.errors}
                    />
                  )}
                </Field>
              );
            }}
          </form.Field>
        </div>
        <form.Field
          mode="array"
          name={`${milestonePath}.requirements` as const}
        >
          {(requirementsField) => {
            return (
              <div className="grid gap-3">
                {requirementsField.state.value.map(
                  (requirement, requirementIndex) => {
                    return (
                      <RequirementEditor
                        autoFocus={requirement.id === autoFocusRequirementId}
                        eventTypes={eventTypes}
                        form={form}
                        key={requirement.id}
                        milestoneIndex={milestoneIndex}
                        onRemove={() => {
                          requirementsField.removeValue(requirementIndex);
                        }}
                        requirementIndex={requirementIndex}
                      />
                    );
                  },
                )}
                <Button
                  className="h-auto min-h-24 border-dashed"
                  onClick={() => {
                    const requirementIndex =
                      requirementsField.state.value.length;

                    const requirementValues = getRequirementValuesForEventType({
                      eventType: FELLOWSHIP_EVENT.UNIT_DEATH,
                      location: {
                        milestoneIndex,
                        requirementIndex,
                      },
                    });

                    const requirement = createRequirementEditorValue({
                      suggestedValues: requirementValues,
                    });

                    setAutoFocusRequirementId(requirement.id);
                    requirementsField.pushValue(requirement);
                  }}
                  type="button"
                  variant="outline"
                >
                  <PlusIcon />
                  Add requirement
                </Button>
              </div>
            );
          }}
        </form.Field>
      </CardContent>
    </Card>
  );
}
