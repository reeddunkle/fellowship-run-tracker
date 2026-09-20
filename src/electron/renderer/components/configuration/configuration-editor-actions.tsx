import {
  CopyPlusIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";

import { CONFIGURATION_FORM_DOM_ID } from "@/electron/renderer/components/configuration/configuration-editor-form-fields.tsx";
import {
  type ConfigurationSaveStateResolver,
  getConfigurationPersistenceState,
  hasUnsavedChanges,
  resolveConfigurationSaveState,
  selectConfigurationEditorFormState,
} from "@/electron/renderer/components/configuration/form/configuration-editor-persistence.ts";
import { type useConfigurationForm } from "@/electron/renderer/components/configuration/form/configuration-form.ts";
import { ConfigurationOverwriteWarning } from "@/electron/renderer/components/configuration/form/configuration-save-state-indicator.tsx";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import {
  useConfigurationActions,
  useSelectedConfiguration,
  useSelectedConfigurationId,
} from "@/electron/renderer/stores/configurations-store/configurations-store.tsx";

type ConfigurationForm = ReturnType<typeof useConfigurationForm>;

type ConfigurationEditorActionsProps = {
  readonly form: ConfigurationForm;
  readonly getSaveState: ConfigurationSaveStateResolver;
};

export function ConfigurationEditorActions({
  form,
  getSaveState,
}: ConfigurationEditorActionsProps) {
  const selectedConfiguration = useSelectedConfiguration();
  const selectedConfigurationId = useSelectedConfigurationId();

  const { deleteConfiguration, isUpdating, newConfiguration } =
    useConfigurationActions();

  const hasSelectedConfiguration = selectedConfiguration !== undefined;

  return (
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
            const saveState = resolveConfigurationSaveState(
              values,
              getSaveState,
            );

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
              saveState: resolveConfigurationSaveState(
                state.values,
                getSaveState,
              ),
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
            saveState: resolveConfigurationSaveState(
              state.values,
              getSaveState,
            ),
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
  );
}
