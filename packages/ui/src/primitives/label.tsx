import { type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@frt/ui/styles/class-names.ts";
import { labelVariants } from "@frt/ui/styles/text.ts";

type LabelProps = React.ComponentProps<"label"> &
  VariantProps<typeof labelVariants> & {
    readonly htmlFor: string;
  };

function Label({
  children,
  className,
  htmlFor,
  variant,
  ...props
}: LabelProps) {
  return (
    <label
      className={cn(
        labelVariants({ variant }),
        "flex items-center gap-2 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-data-disabled:cursor-not-allowed peer-data-disabled:opacity-50",
        className,
      )}
      data-slot="label"
      htmlFor={htmlFor}
      {...props}
    >
      {children}
    </label>
  );
}

export { Label };
