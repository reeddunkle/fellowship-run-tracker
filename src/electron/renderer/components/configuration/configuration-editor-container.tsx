import { useMemo } from "react";

import { ConfigurationEditor } from "@/electron/renderer/components/configuration/configuration-editor.tsx";
import { EMPTY_CONFIGURATION_EDITOR_VALUE } from "@/electron/renderer/components/configuration/configuration-form.ts";
import { createConfigurationEditorValue } from "@/electron/renderer/components/configuration/helpers/configuration-editor-adapter.ts";
import { type DungeonOption } from "@/electron/renderer/components/configuration/helpers/configuration-editor-types.ts";
import { makeConfigurationSaveStateLookup } from "@/electron/renderer/components/configuration/helpers/configuration-save-state.ts";
import {
  useConfigurationSaveStatus,
  useConfigurations,
  useConfigurationUpdateStatus,
  useSelectedConfiguration,
  useSelectedConfigurationId,
} from "@/electron/renderer/stores/configurations-store/configurations-store.tsx";
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
  const selectedConfigurationId = useSelectedConfigurationId();

  const { revision: saveRevision } = useConfigurationSaveStatus();
  const { revision: updateRevision } = useConfigurationUpdateStatus();

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

  return (
    <ConfigurationEditor
      defaultValue={defaultValue}
      dungeonOptions={dungeonOptions}
      eventTypes={eventTypes}
      getSaveState={configurationSaveState.get}
      key={`${selectedConfigurationId ?? "new"}:${saveRevision}:${updateRevision}`}
    />
  );
}
