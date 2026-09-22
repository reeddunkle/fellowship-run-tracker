import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@frt/ui/class-names.ts";
import {
  controlFrameStyles,
  controlSizeStyles,
  textControlStyles,
} from "@frt/ui/primitive-styles.ts";

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default";
};

export function NativeSelect({
  className,
  size = "default",
  ...props
}: NativeSelectProps) {
  return (
    <div
      className={cn("group/native-select relative w-fit", className)}
      data-size={size}
      data-slot="native-select-wrapper"
    >
      <select
        className={cn(
          controlFrameStyles,
          controlSizeStyles[size],
          textControlStyles,
          "w-full cursor-pointer appearance-none py-1 pr-8 pl-2.5 select-none selection:bg-primary selection:text-primary-foreground disabled:pointer-events-none dark:enabled:hover:bg-input/50",
        )}
        data-size={size}
        data-slot="native-select"
        {...props}
      />
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none"
        data-slot="native-select-icon"
      />
    </div>
  );
}

export function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      data-slot="native-select-option"
      {...props}
    />
  );
}

export function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      data-slot="native-select-optgroup"
      {...props}
    />
  );
}
