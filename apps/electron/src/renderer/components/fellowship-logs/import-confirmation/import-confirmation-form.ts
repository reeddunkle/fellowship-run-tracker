import { useForm } from "@tanstack/react-form";
import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type DecodedImportConfirmationFormValue,
  ImportConfirmationFormSchema,
  ImportConfirmationFormStandardSchema,
  type ImportConfirmationFormValue,
} from "./import-confirmation-form-schema.ts";

const DEFAULT_IMPORT_CONFIRMATION_FORM_VALUE: ImportConfirmationFormValue = {
  isOwnRun: false,
};

type UseImportConfirmationFormOptions = {
  readonly onConfirm: (
    value: DecodedImportConfirmationFormValue,
  ) => void | Promise<void>;
};

export function useImportConfirmationForm({
  onConfirm,
}: UseImportConfirmationFormOptions) {
  return useForm({
    defaultValues: DEFAULT_IMPORT_CONFIRMATION_FORM_VALUE,

    onSubmit: ({ value }) => {
      return E.gen(function* () {
        const decoded = yield* Schema.decodeEffect(
          ImportConfirmationFormSchema,
        )(value);

        yield* E.promise(() => {
          return Promise.resolve(onConfirm(decoded));
        });
      }).pipe(E.runPromise);
    },

    validators: {
      onChange: ImportConfirmationFormStandardSchema,
      onSubmit: ImportConfirmationFormStandardSchema,
    },
  });
}
