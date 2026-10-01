import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@frt/ui/styles/class-names.ts";
import {
  popupAnimationStyles,
  popupSurfaceStyles,
} from "@frt/ui/styles/surface.ts";
import { descriptionStyles, labelVariants } from "@frt/ui/styles/text.ts";

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

const popoverContentVariants = cva("z-50 flex flex-col text-sm", {
  defaultVariants: { size: "default" },
  variants: {
    size: {
      default: "w-72 gap-2.5 p-2.5",
      lg: "min-w-72 gap-4 rounded-2xl p-6 shadow-2xl",
    },
  },
});

function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  container,
  side = "bottom",
  sideOffset = 4,
  size,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > &
  VariantProps<typeof popoverContentVariants> & {
    readonly container?: PopoverPrimitive.Portal.Props["container"];
  }) {
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className="isolate z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          className={cn(
            popupSurfaceStyles,
            popupAnimationStyles,
            popoverContentVariants({ size }),
            className,
          )}
          data-slot="popover-content"
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-0.5 text-sm", className)}
      data-slot="popover-header"
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      className={cn(labelVariants(), className)}
      data-slot="popover-title"
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      className={cn(descriptionStyles, className)}
      data-slot="popover-description"
      {...props}
    />
  );
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
