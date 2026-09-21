import { useMemo } from "react";

import { ConfigurationEditor } from "@/electron/renderer/components/configuration/configuration-editor.tsx";
import { createConfigurationEditorValue } from "@/electron/renderer/components/configuration/form/configuration-editor-adapter.ts";
import { EMPTY_CONFIGURATION_EDITOR_VALUE } from "@/electron/renderer/components/configuration/form/configuration-form.ts";
import { makeConfigurationSaveStateLookup } from "@/electron/renderer/components/configuration/form/configuration-save-state.ts";
import { type DungeonOption } from "@/electron/renderer/components/configuration/helpers/configuration-editor-types.ts";
import {
  useConfigurations,
  useSelectedConfiguration,
} from "@/electron/renderer/stores/configuration/configuration-provider.tsx";
import { useFellowshipDataStore } from "@/electron/renderer/stores/fellowship-data/fellowship-data-store.tsx";
import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";

const eventTypes = [
  FELLOWSHIP_EVENT.ABILITY_ACTIVATED,
  FELLOWSHIP_EVENT.DUNGEON_START,
  FELLOWSHIP_EVENT.DUNGEON_END,
  FELLOWSHIP_EVENT.ENCOUNTER_START,
  FELLOWSHIP_EVENT.ENCOUNTER_END,
  FELLOWSHIP_EVENT.UNIT_DEATH,
] satisfies ReadonlyArray<RequirementEventType>;

export function ConfigurationEditorContainer() {
  const configurations = useConfigurations();
  const selectedConfiguration = useSelectedConfiguration();

  const dungeons = useFellowshipDataStore((state) => state.dungeons);

  const configurationSaveState = useMemo(() => {
    return makeConfigurationSaveStateLookup(configurations);
  }, [configurations]);

  const dungeonOptions = useMemo<ReadonlyArray<DungeonOption>>(() => {
    return dungeons.map((dungeon) => {
      return {
        key: dungeon.id,
        label: dungeon.name,
      };
    });
  }, [dungeons]);

  const defaultValue =
    selectedConfiguration === undefined
      ? EMPTY_CONFIGURATION_EDITOR_VALUE
      : createConfigurationEditorValue(selectedConfiguration);

  const editorKey =
    selectedConfiguration === undefined
      ? "new"
      : `${selectedConfiguration.id}:${selectedConfiguration.fingerprint}:${selectedConfiguration.label}`;

  return (
    <ConfigurationEditor
      defaultValue={defaultValue}
      dungeonOptions={dungeonOptions}
      eventTypes={eventTypes}
      getSaveState={configurationSaveState.get}
      key={editorKey}
    />
  );
}
