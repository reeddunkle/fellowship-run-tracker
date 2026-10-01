import { cva } from "class-variance-authority";

import { labelVariants } from "@frt/ui/styles/text.ts";

export const menuItemVariants = cva(
  "relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: { variant: "default" },
    variants: {
      inset: { true: "pl-7" },
      variant: {
        default: "",
        destructive:
          "text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20 *:[svg]:text-destructive",
      },
    },
  },
);

export const menuLabelStyles = [
  labelVariants({ variant: "group" }),
  "px-1.5 py-1",
];

export const menuSeparatorStyles =
  "pointer-events-none -mx-1 my-1 h-px bg-border";
