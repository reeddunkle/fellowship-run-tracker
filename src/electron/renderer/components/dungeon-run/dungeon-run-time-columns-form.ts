import { useForm } from "@tanstack/react-form";
import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  DungeonRunTimeColumnsFormSchema,
  DungeonRunTimeColumnsFormStandardSchema,
  type DungeonRunTimeColumnsFormValue,
} from "./dungeon-run-time-columns-form-schema.ts";

type UseDungeonRunTimeColumnsFormOptions = {
  readonly defaultValues: DungeonRunTimeColumnsFormValue;
  readonly onApply: (
    value: DungeonRunTimeColumnsFormValue,
  ) => void | Promise<void>;
};

export function useDungeonRunTimeColumnsForm({
  defaultValues,
  onApply,
}: UseDungeonRunTimeColumnsFormOptions) {
  return useForm({
    defaultValues,

    onSubmit: ({ value }) => {
      return E.gen(function* () {
        const decoded = yield* Schema.decodeEffect(
          DungeonRunTimeColumnsFormSchema,
        )(value);

        yield* E.promise(() => {
          return Promise.resolve(onApply(decoded));
        });
      }).pipe(E.runPromise);
    },

    validators: {
      onChange: DungeonRunTimeColumnsFormStandardSchema,
      onSubmit: DungeonRunTimeColumnsFormStandardSchema,
    },
  });
}

export type DungeonRunTimeColumnsFormApi = ReturnType<
  typeof useDungeonRunTimeColumnsForm
>;
