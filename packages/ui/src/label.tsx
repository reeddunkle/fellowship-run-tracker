import type * as React from "react";

import { cn } from "@frt/ui/class-names.ts";
import { labelVariants } from "@frt/ui/primitive-styles.ts";

type LabelProps = React.ComponentProps<"label"> & {
  readonly htmlFor: string;
};

function Label({ children, className, htmlFor, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        labelVariants(),
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
