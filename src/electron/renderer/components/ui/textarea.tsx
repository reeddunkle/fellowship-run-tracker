import type * as React from "react";

import {
  controlFrameStyles,
  textControlStyles,
} from "@/electron/renderer/components/ui/primitive-styles";
import { cn } from "@/util/class-names";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        controlFrameStyles,
        textControlStyles,
        "flex field-sizing-content min-h-16 w-full px-2.5 py-2",
        className,
      )}
      data-slot="textarea"
      {...props}
    />
  );
}

export { Textarea };
