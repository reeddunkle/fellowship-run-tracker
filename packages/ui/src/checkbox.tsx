import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";

import { cn } from "@frt/ui/class-names.ts";
import { choiceControlStyles } from "@frt/ui/primitive-styles.ts";

export function Checkbox({
  className,
  checked,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      className={cn(choiceControlStyles, "rounded-[4px]", className)}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
        data-slot="checkbox-indicator"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
