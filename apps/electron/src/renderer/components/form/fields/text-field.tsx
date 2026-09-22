import type * as React from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@frt/ui/field.tsx";
import { Input } from "@frt/ui/input.tsx";

import { useFieldContext } from "../form-context.ts";

type AppTextFieldProps = {
  readonly description?: React.ReactNode;
  readonly errorClassName?: string;
  readonly fieldClassName?: string;
  readonly label: React.ReactNode;
} & Omit<
  React.ComponentProps<typeof Input>,
  "aria-invalid" | "id" | "name" | "onBlur" | "onChange" | "value"
>;

export function AppTextField({
  description,
  errorClassName,
  fieldClassName,
  label,
  ...inputProps
}: AppTextFieldProps) {
  const field = useFieldContext<string>();

  const isInvalid = field.state.meta.isBlurred && !field.state.meta.isValid;

  return (
    <Field className={fieldClassName} data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        aria-invalid={isInvalid}
        id={field.name}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => {
          field.handleChange(event.target.value);
        }}
        value={field.state.value}
        {...inputProps}
      />
      {description !== undefined ? (
        <FieldDescription>{description}</FieldDescription>
      ) : null}
      {isInvalid ? (
        <FieldError
          className={errorClassName}
          errors={field.state.meta.errors}
        />
      ) : null}
    </Field>
  );
}
