import { EllipsisVerticalIcon, Trash2Icon } from "lucide-react";

import { type ConfigurationApiConfiguration } from "@frt/shared/configuration/configuration-api-schema.ts";
import { type ConfigurationId } from "@frt/shared/configuration/configuration-id-schema.ts";
import { Button } from "@frt/ui/primitives/button.tsx";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@frt/ui/primitives/popover.tsx";
import { Separator } from "@frt/ui/primitives/separator.tsx";

import { formatLocalDateTime } from "@/util/format-date-time.ts";

type ConfigurationSidebarItemActionsProps = {
  readonly configuration: ConfigurationApiConfiguration;
  readonly onDelete: (id: ConfigurationId) => void;
};

export function ConfigurationSidebarItemActions({
  configuration,
  onDelete,
}: ConfigurationSidebarItemActionsProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label={`Actions for ${configuration.label}`}
            shape="round"
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
