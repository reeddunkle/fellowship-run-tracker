import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import {
  controlSizeStyles,
  focusRingStyles,
  invalidControlStyles,
} from "@/electron/renderer/components/ui/primitive-styles";
import { cn } from "@/util/class-names";

const buttonStyles = cva(
  [
    focusRingStyles,
    invalidControlStyles,
    "group/button inline-flex shrink-0 cursor-pointer items-center justify-center border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: [
          controlSizeStyles.default,
          "gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        ],
        icon: controlSizeStyles.icon,
        "icon-lg": [
          controlSizeStyles["icon-lg"],
          "[&_svg:not([class*='size-'])]:size-4.5",
        ],
        "icon-sm": [
          controlSizeStyles["icon-sm"],
          "[&_svg:not([class*='size-'])]:size-3.5",
        ],
        "icon-xl": [
          controlSizeStyles["icon-xl"],
          "[&_svg:not([class*='size-'])]:size-5",
        ],
        "icon-xs": [
          controlSizeStyles["icon-xs"],
          "[&_svg:not([class*='size-'])]:size-3",
        ],
        lg: [
          controlSizeStyles.lg,
          "gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4.5",
        ],
        sm: [
          controlSizeStyles.sm,
          "gap-1 px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        ],
        xl: [
          controlSizeStyles.xl,
          "gap-2 px-4 text-base has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-5",
        ],
        xs: [
          controlSizeStyles.xs,
          "gap-1 px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        ],
      },
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
      },
    },
  },
);

function buttonVariants(props?: Parameters<typeof buttonStyles>[0]) {
  return cn(buttonStyles(props));
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      className={buttonVariants({ className, size, variant })}
      data-slot="button"
      {...props}
    />
  );
}

export { Button, buttonVariants };
