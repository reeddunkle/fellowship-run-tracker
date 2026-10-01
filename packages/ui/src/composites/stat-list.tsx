import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@frt/ui/styles/class-names.ts";

export function StatList({ className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl
      className={cn("grid gap-4 text-sm", className)}
      data-slot="stat-list"
      {...props}
    />
  );
}

export function Stat({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={className} data-slot="stat" {...props} />;
}

export function StatLabel({ className, ...props }: React.ComponentProps<"dt">) {
  return (
    <dt
      className={cn("text-muted-foreground", className)}
      data-slot="stat-label"
      {...props}
    />
  );
}

const statValueVariants = cva("font-medium tabular-nums", {
  defaultVariants: { variant: "default" },
  variants: {
    variant: {
      default: "",
      destructive: "text-destructive",
    },
  },
});

export function StatValue({
  className,
  variant,
  ...props
}: React.ComponentProps<"dd"> & VariantProps<typeof statValueVariants>) {
  return (
    <dd
      className={cn(statValueVariants({ variant }), className)}
      data-slot="stat-value"
      {...props}
    />
  );
}
