import { cva } from "class-variance-authority";

export const controlSizeStyles = {
  default: "h-10 rounded-lg",
  icon: "size-10 rounded-lg",
  "icon-lg": "size-11 rounded-lg",
  "icon-sm": "size-9 rounded-md",
  "icon-xl": "size-12 rounded-lg",
  "icon-xs": "size-8 rounded-md",
  lg: "h-11 rounded-lg",
  sm: "h-9 rounded-md",
  xl: "h-12 rounded-lg",
  xs: "h-8 rounded-md",
};

export const focusRingStyles =
  "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export const invalidControlStyles =
  "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

export const controlFrameStyles = [
  "min-w-0 rounded-lg border border-input bg-transparent transition-colors disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30 dark:disabled:bg-input/80",
  focusRingStyles,
  invalidControlStyles,
];

export const textControlStyles =
  "text-base placeholder:text-muted-foreground md:text-sm";

export const choiceControlStyles = [
  "peer relative flex size-4.5 shrink-0 cursor-pointer items-center justify-center border border-input bg-background transition-colors after:absolute after:-inset-x-3 after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-focus-visible/field-label:ring-0",
  focusRingStyles,
  invalidControlStyles,
];

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

export const popupSurfaceStyles =
  "rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none";

export const popupAnimationStyles =
  "origin-(--transform-origin) duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";

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
