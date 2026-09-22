import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "@frt/ui/class-names.ts";
import { choiceControlStyles } from "@frt/ui/primitive-styles.ts";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      className={cn("grid w-full gap-2", className)}
      data-slot="radio-group"
      {...props}
    />
  );
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      className={cn(
        choiceControlStyles,
        "group/radio-group-item rounded-full",
        className,
      )}
      data-slot="radio-group-item"
      {...props}
    >
      <RadioPrimitive.Indicator
        className="flex items-center justify-center"
        data-slot="radio-group-indicator"
      >
        <span className="size-2 rounded-full bg-current" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
