import * as Match from "effect/Match";
import * as R from "effect/Record";
import { useState } from "react";

import { useConfigurationEditor } from "@/electron/renderer/components/configuration/configuration-editor-provider.tsx";
import { type ConfigurationFormApi } from "@/electron/renderer/components/configuration/form/configuration-form.ts";
import { type RequirementLocation } from "@/electron/renderer/components/configuration/helpers/configuration-editor-metadata.ts";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/electron/renderer/components/ui/field.tsx";
import { Input } from "@/electron/renderer/components/ui/input.tsx";
import { useFellowshipDataStore } from "@/electron/renderer/stores/fellowship-data/fellowship-data-store.tsx";
import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";

import { CUSTOM_TARGET, TargetSelect } from "./target-select.tsx";

type RequirementTargetFieldProps = {
  readonly eventType: RequirementEventType;
  readonly form: ConfigurationFormApi;
  readonly location: RequirementLocation;
  readonly requirementPath: `milestones[${number}].requirements[${number}]`;
};

export function RequirementTargetField({
  eventType,
  form,
  location,
  requirementPath,
}: RequirementTargetFieldProps) {
  const [customTargetValue, setCustomTargetValue] = useState<
    string | undefined
  >();
  const [isCustomInputBlurred, setIsCustomInputBlurred] = useState(false);
  const { getUnitDeathSuggestion } = useConfigurationEditor();
  const abilities = useFellowshipDataStore((state) => state.abilities);
  const dungeons = useFellowshipDataStore((state) => state.dungeons);
  const encounters = useFellowshipDataStore((state) => state.encounters);
  const units = useFellowshipDataStore((state) => state.units);

  const selectedDungeonId = form.state.values.dungeonId;

  const dungeonUnits = units.filter((unit) => {
    return unit.dungeonIds.includes(selectedDungeonId);
  });

  const dungeonUnitIds = new Set(dungeonUnits.map((unit) => unit.id));

  const dungeonEncounters = encounters.filter((encounter) => {
    return encounter.dungeonId === selectedDungeonId;
  });

  const dungeonAbilities = abilities.filter((ability) => {
    return ability.unitId === null || dungeonUnitIds.has(ability.unitId);
  });

  const options = Match.value(eventType).pipe(
    Match.when(FELLOWSHIP_EVENT.ABILITY_ACTIVATED, () => {
      return dungeonAbilities.map((ability) => {
        return {
          label: ability.name,
          value: ability.id,
        };
      });
    }),
    Match.whenOr(
      FELLOWSHIP_EVENT.DUNGEON_START,
      FELLOWSHIP_EVENT.DUNGEON_END,
      () => {
        return dungeons.map((dungeon) => {
          return {
            label: dungeon.name,
            value: dungeon.id,
          };
        });
      },
    ),
    Match.whenOr(
      FELLOWSHIP_EVENT.ENCOUNTER_START,
      FELLOWSHIP_EVENT.ENCOUNTER_END,
      () => {
        return dungeonEncounters.map((encounter) => {
          return {
            label: encounter.name,
            value: encounter.id,
          };
        });
      },
    ),
    Match.when(FELLOWSHIP_EVENT.UNIT_DEATH, () => {
      return dungeonUnits.map((unit) => {
        const label =
          unit.variant === null ? unit.name : `${unit.name} (${unit.variant})`;

        return {
          label,
          value: unit.id,
        };
      });
    }),
    Match.exhaustive,
  );

  const optionsByValue = R.fromIterableBy(options, (option) => option.value);

  const handleTargetChange = (targetId: string) => {
    form.setFieldValue(`${requirementPath}.targetId`, targetId);

    if (eventType !== FELLOWSHIP_EVENT.UNIT_DEATH || targetId === "") {
      return;
    }

    const suggestion = getUnitDeathSuggestion({
      location,
      targetId,
    });

    form.setFieldValue(
      `${requirementPath}.startOccurrence`,
      suggestion.startOccurrence,
    );
  };

  return (
    <form.Field name={`${requirementPath}.targetId` as const}>
      {(field) => {
        const existingOption = optionsByValue[field.state.value];

        const isCustomOverride =
          customTargetValue !== undefined &&
          customTargetValue === field.state.value;

        const selectedValue = isCustomOverride
          ? CUSTOM_TARGET
          : (existingOption?.value ?? CUSTOM_TARGET);

        const isCustom = selectedValue === CUSTOM_TARGET;
        const isInvalid = !field.state.meta.isValid;
        const showError =
          isInvalid &&
          (isCustom ? isCustomInputBlurred : field.state.meta.isBlurred);

        return (
          <Field data-invalid={showError}>
            <FieldLabel htmlFor={`${field.name}-select`}>Target</FieldLabel>
            <TargetSelect
              id={`${field.name}-select`}
              isInvalid={!isCustom && isInvalid}
              name={`${field.name}-select`}
              onBlur={field.handleBlur}
              onChange={(value) => {
                if (value === CUSTOM_TARGET) {
                  setCustomTargetValue("");
                  setIsCustomInputBlurred(false);
                  handleTargetChange("");
                  return;
                }

                setCustomTargetValue(undefined);
                setIsCustomInputBlurred(false);

                const option = optionsByValue[value];

                if (option !== undefined) {
                  handleTargetChange(option.value);
                }
              }}
              options={options}
              value={selectedValue}
            />
            {isCustom && (
              <>
                <FieldLabel htmlFor={field.name}>Target ID</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  id={field.name}
                  inputMode="numeric"
                  name={field.name}
                  onBlur={() => {
                    setIsCustomInputBlurred(true);
                    field.handleBlur();
                  }}
                  onChange={(event) => {
                    const value = event.target.value;

                    setCustomTargetValue(value);
                    handleTargetChange(value);
                  }}
                  placeholder="Target ID"
                  value={field.state.value}
                />
              </>
            )}
            {showError && <FieldError errors={field.state.meta.errors} />}
          </Field>
        );
      }}
    </form.Field>
  );
}
