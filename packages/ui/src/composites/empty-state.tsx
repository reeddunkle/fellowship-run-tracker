import type * as React from "react";

import { Empty, EmptyDescription } from "@frt/ui/primitives/empty.tsx";
import { cn } from "@frt/ui/styles/class-names.ts";

type EmptyStateProps = React.ComponentProps<"div"> & {
  readonly variant?: "default" | "outline";
};

export function EmptyState({
  children,
  className,
  variant = "default",
  ...props
}: EmptyStateProps) {
  if (variant === "outline") {
    return (
      <Empty
        className={className}
        data-slot="empty-state"
        variant="outline"
        {...props}
      >
        <EmptyDescription>{children}</EmptyDescription>
      </Empty>
    );
  }

  return (
    <div
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="empty-state"
      {...props}
    >
      {children}
    </div>
  );
}
