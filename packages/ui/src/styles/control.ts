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
