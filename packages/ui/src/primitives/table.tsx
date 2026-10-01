import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@frt/ui/styles/class-names.ts";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      className="relative w-full overflow-x-auto rounded-lg border"
      data-slot="table-container"
    >
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        data-slot="table"
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn("bg-muted/50 [&_tr]:border-b", className)}
      data-slot="table-header"
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn("[&_tr:last-child]:border-0", className)}
      data-slot="table-body"
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className,
      )}
      data-slot="table-footer"
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      data-slot="table-row"
      {...props}
    />
  );
}

const tableAlignVariants = cva("", {
  defaultVariants: { align: "start" },
  variants: {
    align: {
      center: "text-center",
      end: "text-right",
      start: "text-left",
    },
  },
});

const tableCellVariants = cva(
  "px-3 py-2 align-top [&:has([role=checkbox])]:pr-0",
  {
    defaultVariants: { variant: "default" },
    variants: {
      variant: {
        default: "",
        muted: "text-muted-foreground",
      },
    },
  },
);

function TableHead({
  align,
  className,
  ...props
}: Omit<React.ComponentProps<"th">, "align"> &
  VariantProps<typeof tableAlignVariants>) {
  return (
    <th
      className={cn(
        "px-3 py-2 align-middle text-xs font-medium whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0",
        tableAlignVariants({ align }),
        className,
      )}
      data-slot="table-head"
      {...props}
    />
  );
}

function TableCell({
  align,
  className,
  variant,
  ...props
}: Omit<React.ComponentProps<"td">, "align"> &
  VariantProps<typeof tableAlignVariants> &
  VariantProps<typeof tableCellVariants>) {
  return (
    <td
      className={cn(
        tableCellVariants({ variant }),
        tableAlignVariants({ align }),
        className,
      )}
      data-slot="table-cell"
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      data-slot="table-caption"
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
