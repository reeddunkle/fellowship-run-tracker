import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@frt/ui/styles/class-names.ts";

const pageShellVariants = cva("mx-auto grid w-full gap-6 p-6", {
  defaultVariants: { size: "default" },
  variants: {
    size: {
      default: "max-w-5xl",
      full: "",
    },
  },
});

export function PageShell({
  className,
  size,
  ...props
}: React.ComponentProps<"main"> & VariantProps<typeof pageShellVariants>) {
  return (
    <main
      className={cn(pageShellVariants({ size }), className)}
      data-slot="page-shell"
      {...props}
    />
  );
}

export function PageHeader({
  className,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header
      className={cn("grid gap-1", className)}
      data-slot="page-header"
      {...props}
    />
  );
}

export function PageTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn("text-2xl font-semibold tracking-tight", className)}
      data-slot="page-title"
      {...props}
    />
  );
}

export function PageDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="page-description"
      {...props}
    />
  );
}
