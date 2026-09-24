import { EllipsisVerticalIcon, Trash2Icon } from "lucide-react";

import { type ConfigurationApiConfiguration } from "@frt/shared/configuration/configuration-api-schema.ts";
import { type ConfigurationId } from "@frt/shared/configuration/configuration-id-schema.ts";
import { Button } from "@frt/ui/button.tsx";
import { cn } from "@frt/ui/class-names.ts";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@frt/ui/popover.tsx";
import { Separator } from "@frt/ui/separator.tsx";

import { formatLocalDateTime } from "@/util/format-date-time.ts";

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
            className={cn(
              "rounded-full",
              isActive &&
                "hover:bg-sidebar-accent-foreground/10 aria-expanded:bg-sidebar-accent-foreground/10 dark:hover:bg-sidebar-accent-foreground/10",
            )}
            size="icon"
            type="button"
            variant="ghost"
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
