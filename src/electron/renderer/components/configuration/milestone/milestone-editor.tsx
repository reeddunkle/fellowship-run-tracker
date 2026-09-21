import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { useConfigurationEditor } from "@/electron/renderer/components/configuration/configuration-editor-provider.tsx";
import {
  type ConfigurationFormApi,
  createRequirementEditorValue,
} from "@/electron/renderer/components/configuration/form/configuration-form.ts";
import { RequirementEditor } from "@/electron/renderer/components/configuration/requirement/requirement-editor.tsx";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/electron/renderer/components/ui/card.tsx";
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
            size="icon"
            type="button"
            variant="destructive"
          >
            <Trash2Icon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex gap-3">
          <form.AppField name={`${milestonePath}.label` as const}>
            {(field) => {
              return (
                <field.TextField
                  fieldClassName="min-w-0 flex-1"
                  label="Label"
                  placeholder="Milestone label"
                />
              );
            }}
          </form.AppField>

          <form.AppField name={`${milestonePath}.comparisonTime` as const}>
            {(field) => {
              return (
                <field.TextField
                  className="field-sizing-content"
                  errorClassName="whitespace-normal contain-[inline-size]"
                  fieldClassName="w-fit"
                  inputMode="text"
                  label="Goal time (optional)"
                  placeholder="1:15 or 1.25"
                />
              );
            }}
          </form.AppField>
        </div>
        <form.AppField
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
        </form.AppField>
      </CardContent>
    </Card>
  );
}
