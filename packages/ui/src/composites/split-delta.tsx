import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@frt/ui/styles/class-names.ts";

const splitDeltaVariants = cva("", {
  variants: {
    status: {
      ahead: "text-split-ahead",
      behind: "text-split-behind",
      best: "text-split-best",
    },
  },
});

export function SplitDelta({
  className,
  status,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof splitDeltaVariants>) {
  return (
    <span
      className={cn(splitDeltaVariants({ status }), className)}
      data-slot="split-delta"
      {...props}
    />
  );
}
