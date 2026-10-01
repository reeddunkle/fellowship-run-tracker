import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@frt/ui/styles/class-names.ts";

const statusTextVariants = cva(
  "has-[>svg]:flex has-[>svg]:items-center [&_svg]:shrink-0",
  {
    defaultVariants: { size: "default", variant: "default" },
    variants: {
      size: {
        default:
          "text-sm has-[>svg]:gap-2 [&_svg:not([class*='size-'])]:size-4",
        xs: "text-xs font-medium has-[>svg]:gap-1.5 [&_svg:not([class*='size-'])]:size-3.5",
      },
      variant: {
        default: "text-muted-foreground",
        destructive: "text-destructive",
        success: "text-success",
        warning: "text-warning",
      },
    },
  },
);

export function StatusText({
  className,
  size,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof statusTextVariants>) {
  return (
    <div
      className={cn(statusTextVariants({ size, variant }), className)}
      data-slot="status-text"
      {...props}
    />
  );
}
