import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";

import {
  controlFrameStyles,
  controlSizeStyles,
  textControlStyles,
} from "@/electron/renderer/components/ui/primitive-styles";
import { cn } from "@/util/class-names";

type InputProps = React.ComponentProps<"input"> & {
  readonly webkitdirectory?: string;
};

export function Input({ className, type, ...props }: InputProps) {
  return (
    <InputPrimitive
      className={cn(
        controlFrameStyles,
        controlSizeStyles.default,
        textControlStyles,
        "w-full px-2.5 py-1 file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:pointer-events-none",
        className,
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}
