import type * as React from "react";

import { cn } from "@/util/class-names";

type LabelProps = React.ComponentProps<"label"> & {
  readonly htmlFor: string;
};

function Label({ children, className, htmlFor, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
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
