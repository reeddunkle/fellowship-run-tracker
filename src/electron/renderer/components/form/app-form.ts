import { createFormHook } from "@tanstack/react-form";

import { AppNumberField } from "./fields/number-field.tsx";
import { AppTextField } from "./fields/text-field.tsx";
import { fieldContext, formContext } from "./form-context.ts";

export const { useAppForm, withForm } = createFormHook({
  fieldComponents: {
    NumberField: AppNumberField,
    TextField: AppTextField,
  },
  fieldContext,
  formComponents: {},
  formContext,
});
