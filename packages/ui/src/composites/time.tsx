import type * as React from "react";

import { cn } from "@frt/ui/styles/class-names.ts";

export function TimeValue({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("font-mono tabular-nums", className)}
      data-slot="time-value"
      {...props}
    />
  );
}

export function TimerDisplay({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("font-mono text-5xl font-semibold tabular-nums", className)}
      data-slot="timer-display"
      {...props}
    />
  );
}
