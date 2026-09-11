import { EllipsisVerticalIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/electron/renderer/components/ui/button.tsx";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/electron/renderer/components/ui/popover.tsx";
import { Separator } from "@/electron/renderer/components/ui/separator";
import { type ConfigurationApiConfiguration } from "@/services/api/configuration/configuration-api-schema.ts";
import { formatLocalDateTime } from "@/util/format-date-time.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

type ConfigurationSidebarItemActionsProps = {
  readonly configuration: ConfigurationApiConfiguration;
  readonly isActive: boolean;
  readonly onDelete: (id: ConfigurationId) => void;
};

export function ConfigurationSidebarItemActions({
  configuration,
  isActive,
  onDelete,
}: ConfigurationSidebarItemActionsProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label={`Actions for ${configuration.label}`}
            className="rounded-full"
            size="icon-xs"
            type="button"
            variant={isActive ? "secondary" : "ghost"}
          />
        }
      >
        <EllipsisVerticalIcon />
      </PopoverTrigger>
      <PopoverContent align="end">
        <PopoverHeader>
          <PopoverTitle>{configuration.label}</PopoverTitle>
          <PopoverDescription>
            Last updated: {formatLocalDateTime(configuration.updatedAt)}
          </PopoverDescription>
        </PopoverHeader>
        <Separator />
        <Button
          className="w-full justify-start"
          onClick={() => {
            onDelete(configuration.id);
          }}
          type="button"
          variant="destructive"
        >
          <Trash2Icon />
          Delete
        </Button>
      </PopoverContent>
    </Popover>
  );
}
