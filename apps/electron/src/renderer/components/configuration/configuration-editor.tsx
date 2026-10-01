import { type RequirementEventType } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";
import {
  PageDescription,
  PageHeader,
  PageTitle,
} from "@frt/ui/composites/page.tsx";

import { ConfigurationEditorActions } from "@/renderer/components/configuration/configuration-editor-actions.tsx";
import { ConfigurationEditorFormFields } from "@/renderer/components/configuration/configuration-editor-form-fields.tsx";
import { ConfigurationEditorHistory } from "@/renderer/components/configuration/configuration-editor-history.tsx";
import { ConfigurationEditorProvider } from "@/renderer/components/configuration/configuration-editor-provider.tsx";
import { saveConfigurationApiRequest } from "@/renderer/components/configuration/form/configuration-editor-adapter.ts";
import { type ConfigurationSaveStateResolver } from "@/renderer/components/configuration/form/configuration-editor-persistence.ts";
import { useConfigurationForm } from "@/renderer/components/configuration/form/configuration-form.ts";
import { type ConfigurationEditorValue } from "@/renderer/components/configuration/form/configuration-form-schema.ts";
import { type DungeonOption } from "@/renderer/components/configuration/helpers/configuration-editor-types.ts";
import { useConfigurationActions } from "@/renderer/stores/configuration/configuration-provider.tsx";

type ConfigurationEditorProps = {
  readonly defaultValue: ConfigurationEditorValue;
  readonly dungeonOptions: ReadonlyArray<DungeonOption>;
  readonly eventTypes: ReadonlyArray<RequirementEventType>;
  readonly getSaveState: ConfigurationSaveStateResolver;
};

export function ConfigurationEditor({
  defaultValue,
  dungeonOptions,
  eventTypes,
  getSaveState,
}: ConfigurationEditorProps) {
  const { save, update } = useConfigurationActions();

  const form = useConfigurationForm({
    defaultValues: defaultValue,
    onSave: (value) => {
      save(saveConfigurationApiRequest(value));
    },
    onUpdate: (id, value) => {
      update(id, saveConfigurationApiRequest(value));
    },
  });

  return (
    <ConfigurationEditorProvider form={form}>
      <section className="grid gap-6">
        <PageHeader>
          <PageTitle>Configure a run</PageTitle>
          <PageDescription>
            Select a saved configuration from the sidebar or create a new one.
          </PageDescription>
        </PageHeader>
        <ConfigurationEditorActions form={form} getSaveState={getSaveState} />
        <ConfigurationEditorHistory />
        <ConfigurationEditorFormFields
          dungeonOptions={dungeonOptions}
          eventTypes={eventTypes}
          form={form}
          getSaveState={getSaveState}
        />
      </section>
    </ConfigurationEditorProvider>
  );
}
