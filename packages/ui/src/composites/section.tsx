import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@frt/ui/styles/class-names.ts";

const sectionVariants = cva("grid", {
  defaultVariants: { variant: "default" },
  variants: {
    variant: {
      dashed: "gap-3 rounded-lg border border-dashed p-4",
      default: "gap-2",
      outline: "gap-3 rounded-lg border p-4",
    },
  },
});

export function Section({
  className,
  variant,
  ...props
}: React.ComponentProps<"section"> & VariantProps<typeof sectionVariants>) {
  return (
    <section
      className={cn(sectionVariants({ variant }), className)}
      data-slot="section"
      {...props}
    />
  );
}

export function SectionHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid gap-1", className)}
      data-slot="section-header"
      {...props}
    />
  );
}

export function SectionTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-sm font-medium", className)}
      data-slot="section-title"
      {...props}
    />
  );
}

export function SectionDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="section-description"
      {...props}
    />
  );
}
