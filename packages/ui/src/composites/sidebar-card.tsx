import type * as React from "react";

import { cn } from "@frt/ui/styles/class-names.ts";

type SidebarCardProps = React.ComponentProps<"div"> & {
  readonly isActive?: boolean;
};

export function SidebarCard({
  className,
  isActive = false,
  ...props
}: SidebarCardProps) {
  return (
    <div
      className={cn(
        "flex items-stretch overflow-hidden rounded-md border border-sidebar-border/60 bg-sidebar-accent/20 text-sidebar-foreground transition-colors data-[active=true]:border-sidebar-accent-foreground/20 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[active=true]:**:data-[slot=button]:hover:bg-sidebar-accent-foreground/10 data-[active=true]:**:data-[slot=button]:aria-expanded:bg-sidebar-accent-foreground/10",
        className,
      )}
      data-active={isActive}
      data-slot="sidebar-card"
      {...props}
    />
  );
}

export function SidebarCardButton({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "flex min-w-0 flex-1 cursor-pointer flex-col items-stretch gap-0.5 p-2 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 focus-visible:ring-inset [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      data-slot="sidebar-card-button"
      type="button"
      {...props}
    />
  );
}

export function SidebarCardDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "truncate text-xs font-normal text-muted-foreground",
        className,
      )}
      data-slot="sidebar-card-description"
      {...props}
    />
  );
}
