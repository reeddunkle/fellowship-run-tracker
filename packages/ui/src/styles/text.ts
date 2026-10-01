import { cva } from "class-variance-authority";

export const labelVariants = cva("leading-snug font-medium", {
  defaultVariants: { variant: "default" },
  variants: {
    variant: {
      default: "text-sm",
      group: "text-xs text-muted-foreground",
    },
  },
});

export const titleStyles = "font-heading text-base leading-snug font-medium";

export const descriptionStyles =
  "text-sm leading-normal font-normal text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary";
