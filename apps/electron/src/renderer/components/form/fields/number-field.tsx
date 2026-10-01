import type * as React from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@frt/ui/primitives/field.tsx";
import { NumberField } from "@frt/ui/primitives/number-field.tsx";

import { useFieldContext } from "../form-context.ts";

type AppNumberFieldProps = {
  readonly description?: React.ReactNode;
  readonly label: React.ReactNode;
} & Omit<
  React.ComponentProps<typeof NumberField>,
  "aria-invalid" | "id" | "name" | "onBlur" | "onChange" | "value"
>;

export function AppNumberField({
  description,
  label,
  ...inputProps
}: AppNumberFieldProps) {
  const field = useFieldContext<number | undefined>();

  const isInvalid = field.state.meta.isBlurred && !field.state.meta.isValid;

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <NumberField
        aria-invalid={isInvalid}
        id={field.name}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => {
          const raw = event.target.value;

          field.handleChange(raw === "" ? undefined : Number(raw));
        }}
        value={field.state.value ?? ""}
        {...inputProps}
      />
      {description !== undefined ? (
        <FieldDescription>{description}</FieldDescription>
      ) : null}
      {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
    </Field>
  );
}
