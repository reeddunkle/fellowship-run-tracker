import { useMemo } from "react";

import { FELLOWSHIP_EVENT } from "@frt/shared/fellowship/constants/fellowship-event.ts";
import { type RequirementEventType } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";

import { ConfigurationEditor } from "@/renderer/components/configuration/configuration-editor.tsx";
import { createConfigurationEditorValue } from "@/renderer/components/configuration/form/configuration-editor-adapter.ts";
import { EMPTY_CONFIGURATION_EDITOR_VALUE } from "@/renderer/components/configuration/form/configuration-form.ts";
import { makeConfigurationSaveStateLookup } from "@/renderer/components/configuration/form/configuration-save-state.ts";
import { type DungeonOption } from "@/renderer/components/configuration/helpers/configuration-editor-types.ts";
import {
  useConfigurations,
  useSelectedConfiguration,
} from "@/renderer/stores/configuration/configuration-provider.tsx";
import { useFellowshipDataStore } from "@/renderer/stores/fellowship-data/fellowship-data-store.tsx";

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
