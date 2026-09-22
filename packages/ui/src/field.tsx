import { cva, type VariantProps } from "class-variance-authority";
import { useMemo } from "react";

import { cn } from "@frt/ui/class-names.ts";
import { Label } from "@frt/ui/label.tsx";
import {
  descriptionStyles,
  labelVariants,
  titleStyles,
} from "@frt/ui/primitive-styles.ts";
import { Separator } from "@frt/ui/separator.tsx";

export function FieldSet({
  className,
  ...props
}: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      className={cn(
        "flex flex-col gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        className,
      )}
      data-slot="field-set"
      {...props}
    />
  );
}

export function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      className={cn(
        variant === "label" ? labelVariants() : titleStyles,
        "mb-1.5",
        className,
      )}
      data-slot="field-legend"
      data-variant={variant}
      {...props}
    />
  );
}

export function FieldGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-5 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4",
        className,
      )}
      data-slot="field-group"
      {...props}
    />
  );
}

export const fieldVariants = cva(
  "group/field flex w-full gap-2 data-[invalid=true]:text-destructive",
  {
    defaultVariants: {
      orientation: "vertical",
    },
    variants: {
      orientation: {
        horizontal:
          "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        responsive:
          "flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
      },
    },
  },
);

export function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      className={cn(fieldVariants({ orientation }), className)}
      data-orientation={orientation}
      data-slot="field"
      {...props}
    />
  );
}

export function FieldContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group/field-content flex flex-1 flex-col gap-0.5 leading-snug",
        className,
      )}
      data-slot="field-content"
      {...props}
    />
  );
}

export function FieldLabel({
  children,
  className,
  htmlFor,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-2 group-data-[disabled=true]/field:opacity-50 has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50 has-[>[data-slot=field]]:has-focus-visible:border-ring has-[>[data-slot=field]]:has-focus-visible:ring-3 has-[>[data-slot=field]]:has-focus-visible:ring-ring/50 *:data-[slot=field]:p-2.5 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
        className,
      )}
      data-slot="field-label"
      htmlFor={htmlFor}
      {...props}
    >
      {children}
    </Label>
  );
}

export function FieldTitle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        labelVariants(),
        "flex w-fit items-center gap-2 group-data-[disabled=true]/field:opacity-50",
        className,
      )}
      data-slot="field-label"
      {...props}
    />
  );
}

export function FieldDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        descriptionStyles,
        "text-left group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5",
        "last:mt-0 nth-last-2:-mt-1",
        className,
      )}
      data-slot="field-description"
      {...props}
    />
  );
}

export function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode;
}) {
  const hasContent = children !== null && children !== undefined;

  return (
    <div
      className={cn(
        "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
        className,
      )}
      data-content={hasContent}
      data-slot="field-separator"
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {hasContent ? (
        <span
          className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      ) : null}
    </div>
  );
}

export function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const content = useMemo(() => {
    if (children !== null && children !== undefined) {
      return children;
    }

    if (errors === undefined || errors.length === 0) {
      return null;
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ];

    if (uniqueErrors.length === 1) {
      return uniqueErrors[0]?.message;
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map((error, index) => {
          if (error?.message === undefined) {
            return null;
          }

          return <li key={index}>{error.message}</li>;
        })}
      </ul>
    );
  }, [children, errors]);

  if (content === null || content === undefined) {
    return null;
  }

  return (
    <div
      className={cn("text-sm font-normal text-destructive", className)}
      data-slot="field-error"
      role="alert"
      {...props}
    >
      {content}
    </div>
  );
}
