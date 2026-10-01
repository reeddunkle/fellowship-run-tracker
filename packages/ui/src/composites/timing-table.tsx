import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@frt/ui/styles/class-names.ts";
import { focusRingStyles } from "@frt/ui/styles/control.ts";

export function TimingTable({
  className,
  ...props
}: React.ComponentProps<"table">) {
  return (
    <table
      className={cn(
        "w-full table-fixed border-separate border-spacing-0",
        className,
      )}
      data-slot="timing-table"
      {...props}
    />
  );
}

export function TimingTableLabelColumn(props: React.ComponentProps<"col">) {
  return (
    <col
      className="min-w-label-column"
      data-slot="timing-table-label-column"
      {...props}
    />
  );
}

export function TimingTableTimeColumn(props: React.ComponentProps<"col">) {
  return (
    <col
      className="w-time-column"
      data-slot="timing-table-time-column"
      {...props}
    />
  );
}

export function TimingTableHeaderRow({
  className,
  ...props
}: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "text-2xs font-medium tracking-wide text-muted-foreground uppercase",
        className,
      )}
      data-slot="timing-table-header-row"
      {...props}
    />
  );
}

export function TimingTableLabelHead({
  className,
  ...props
}: React.ComponentProps<"th">) {
  return (
    <th
      className={cn("px-3 text-left font-medium", className)}
      data-slot="timing-table-label-head"
      scope="col"
      {...props}
    />
  );
}

export function TimingTableTimeHead({
  className,
  ...props
}: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "min-w-time-header px-2 text-left font-normal whitespace-nowrap",
        className,
      )}
      data-slot="timing-table-time-head"
      scope="col"
      {...props}
    />
  );
}

const timingTableRowVariants = cva(
  "[&>td]:border-t [&>td+td]:border-l [&>td+td]:border-border/50 [&>td:first-child]:border-l [&>td:last-child]:border-r [&>td:last-child]:pr-3 last:[&>td]:border-b last:[&>td:first-child]:rounded-bl-md last:[&>td:last-child]:rounded-br-md",
  {
    defaultVariants: { variant: "group" },
    variants: {
      variant: {
        group:
          "text-sm transition-colors hover:bg-muted/40 dark:hover:bg-muted/20 [&>td:first-child]:rounded-tl-md [&>td:last-child]:rounded-tr-md",
        item: "text-xs",
      },
    },
  },
);

export function TimingTableBody({
  className,
  ...props
}: React.ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn("bg-card", className)}
      data-slot="timing-table-body"
      {...props}
    />
  );
}

export function TimingTableRow({
  className,
  variant,
  ...props
}: React.ComponentProps<"tr"> & VariantProps<typeof timingTableRowVariants>) {
  return (
    <tr
      className={cn(timingTableRowVariants({ variant }), className)}
      data-slot="timing-table-row"
      {...props}
    />
  );
}

export function TimingTableRowToggle({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      className={cn(
        focusRingStyles,
        "flex h-full w-full min-w-0 cursor-pointer items-center justify-start gap-1.5 px-3 py-2 text-left select-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      data-slot="timing-table-row-toggle"
      type="button"
      {...props}
    />
  );
}

const timingTableLabelCellVariants = cva(
  "min-w-time-column overflow-hidden align-middle",
  {
    variants: {
      inset: { true: "py-1.5 pr-2 pl-8" },
    },
  },
);

export function TimingTableLabelCell({
  children,
  className,
  inset,
  ...props
}: React.ComponentProps<"td"> &
  VariantProps<typeof timingTableLabelCellVariants>) {
  return (
    <td
      className={cn(timingTableLabelCellVariants({ inset }), className)}
      data-slot="timing-table-label-cell"
      {...props}
    >
      <div className="min-w-0 overflow-hidden">{children}</div>
    </td>
  );
}

const timingTableTimeCellVariants = cva(
  "min-w-time-column px-2 text-right align-middle font-mono whitespace-nowrap tabular-nums",
  {
    variants: {
      divider: { true: "border-l-2! border-l-border!" },
    },
  },
);

export function TimingTableTimeCell({
  className,
  divider,
  ...props
}: React.ComponentProps<"td"> &
  VariantProps<typeof timingTableTimeCellVariants>) {
  return (
    <td
      className={cn(timingTableTimeCellVariants({ divider }), className)}
      data-slot="timing-table-time-cell"
      {...props}
    />
  );
}
