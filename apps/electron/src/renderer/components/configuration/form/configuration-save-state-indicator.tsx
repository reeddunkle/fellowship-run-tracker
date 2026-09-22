import { AlertTriangleIcon } from "lucide-react";

export function ConfigurationOverwriteWarning({
  configurationLabel,
}: {
  readonly configurationLabel: string;
}) {
  return (
    <div className="text-sm text-amber-600 dark:text-amber-400">
      <div className="flex items-center gap-2">
        <AlertTriangleIcon className="size-4 shrink-0" />
        <span>This is identical to another configuration.</span>
      </div>
      <div>Updating will overwrite "{configurationLabel}".</div>
    </div>
  );
}
