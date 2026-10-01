import { AlertTriangleIcon } from "lucide-react";

import { StatusText } from "@frt/ui/composites/status-text.tsx";

export function ConfigurationOverwriteWarning({
  configurationLabel,
}: {
  readonly configurationLabel: string;
}) {
  return (
    <StatusText variant="warning">
      <div className="flex items-center gap-2">
        <AlertTriangleIcon className="size-4 shrink-0" />
        <span>This is identical to another configuration.</span>
      </div>
      <div>Updating will overwrite "{configurationLabel}".</div>
    </StatusText>
  );
}
