import { ConfigurationEditorActions } from "@/electron/renderer/components/configuration/configuration-editor-actions.tsx";
import { ConfigurationEditorFormFields } from "@/electron/renderer/components/configuration/configuration-editor-form-fields.tsx";
import { ConfigurationEditorHistory } from "@/electron/renderer/components/configuration/configuration-editor-history.tsx";
import { ConfigurationEditorProvider } from "@/electron/renderer/components/configuration/configuration-editor-provider.tsx";
import { saveConfigurationApiRequest } from "@/electron/renderer/components/configuration/form/configuration-editor-adapter.ts";
import { type ConfigurationSaveStateResolver } from "@/electron/renderer/components/configuration/form/configuration-editor-persistence.ts";
import { useConfigurationForm } from "@/electron/renderer/components/configuration/form/configuration-form.ts";
import { type ConfigurationEditorValue } from "@/electron/renderer/components/configuration/form/configuration-form-schema.ts";
import { type DungeonOption } from "@/electron/renderer/components/configuration/helpers/configuration-editor-types.ts";
import { useConfigurationActions } from "@/electron/renderer/stores/configuration/configuration-provider.tsx";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";

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
        <header className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Configure a run
          </h1>
          <p className="text-sm text-muted-foreground">
            Select a saved configuration from the sidebar or create a new one.
          </p>
        </header>
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
