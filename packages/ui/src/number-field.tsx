import type * as React from "react";

import { Input } from "@frt/ui/input.tsx";

type NumberFieldProps = Omit<React.ComponentProps<typeof Input>, "type">;

export function NumberField({
  inputMode = "numeric",
  ...props
}: NumberFieldProps) {
  return <Input inputMode={inputMode} type="number" {...props} />;
}
