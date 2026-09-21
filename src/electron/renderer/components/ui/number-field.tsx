import type * as React from "react";

import { Input } from "@/electron/renderer/components/ui/input";

type NumberFieldProps = Omit<React.ComponentProps<typeof Input>, "type">;

export function NumberField({
  inputMode = "numeric",
  ...props
}: NumberFieldProps) {
  return <Input inputMode={inputMode} type="number" {...props} />;
}
