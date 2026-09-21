import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

import { useAppForm } from "@/electron/renderer/components/form/app-form.ts";
import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

import { type RequirementValuesForEventType } from "../configuration-editor-provider.tsx";
import {
  ConfigurationEditorSchema,
  ConfigurationEditorStandardSchema,
  type ConfigurationEditorValue,
  type DecodedConfigurationEditorValue,
  type MilestoneEditorValue,
  type RequirementEditorValue,
} from "./configuration-form-schema.ts";

export const EMPTY_CONFIGURATION_EDITOR_VALUE: ConfigurationEditorValue = {
  dungeonId: "",
  dungeonLevel: undefined,
  label: "",
  milestones: [],
};

type CreateRequirementEditorValueOptions = {
  readonly suggestedValues?: Partial<RequirementValuesForEventType>;
};

export type ConfigurationSubmitType = "SAVE" | "UPDATE";

export type ConfigurationSubmitMeta =
  | {
      readonly type: "SAVE";
    }
  | {
      readonly configurationId: ConfigurationId;
      readonly type: "UPDATE";
    };

export function createRequirementEditorValue({
  suggestedValues = {},
}: CreateRequirementEditorValueOptions = {}): RequirementEditorValue {
  return {
    // @effect-diagnostics-next-line cryptoRandomUUID:off
    id: crypto.randomUUID(),
    requiredCount: suggestedValues.requiredCount ?? 1,
    startOccurrence: suggestedValues.startOccurrence ?? 1,
    targetId: suggestedValues.targetId ?? "",
    type: FELLOWSHIP_EVENT.UNIT_DEATH,
  };
}

export function createMilestoneEditorValue(): MilestoneEditorValue {
  return {
    comparisonTime: "",
    // @effect-diagnostics-next-line cryptoRandomUUID:off
    id: crypto.randomUUID(),
    label: "",
    requirements: [],
  };
}

type UseConfigurationFormOptions = {
  readonly defaultValues: ConfigurationEditorValue;
  readonly onSave: (
    value: DecodedConfigurationEditorValue,
  ) => void | Promise<void>;
  readonly onUpdate: (
    id: ConfigurationId,
    value: DecodedConfigurationEditorValue,
  ) => void | Promise<void>;
};

export function useConfigurationForm({
  defaultValues,
  onSave,
  onUpdate,
}: UseConfigurationFormOptions) {
  return useAppForm({
    defaultValues,

    onSubmit: ({ meta, value }) => {
      return E.gen(function* () {
        /*
         * Standard Schema validation does not replace TanStack Form's editable
         * values with Effect Schema's transformed output. Decode once more at
         * the submit boundary so numeric strings become actual numbers.
         */
        const decoded = yield* Schema.decodeUnknownEffect(
          ConfigurationEditorSchema,
        )(value);

        yield* Match.value(meta).pipe(
          Match.when({ type: "SAVE" }, () => {
            return E.promise(() => {
              return Promise.resolve(onSave(decoded));
            });
          }),
          Match.when({ type: "UPDATE" }, ({ configurationId }) => {
            return E.promise(() => {
              return Promise.resolve(onUpdate(configurationId, decoded));
            });
          }),
          Match.exhaustive,
        );
      }).pipe(E.runPromise);
    },

    onSubmitMeta: {} as ConfigurationSubmitMeta,

    validators: {
      onChange: ConfigurationEditorStandardSchema,
      onSubmit: ConfigurationEditorStandardSchema,
    },
  });
}

export type ConfigurationFormApi = ReturnType<typeof useConfigurationForm>;
