import { FileTextIcon } from "lucide-react";

import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/electron/renderer/components/ui/sidebar.tsx";
import { type ConfigurationApiConfiguration } from "@/services/api/configuration/configuration-api-schema.ts";
import { formatRelativeDateTime } from "@/util/format-date-time.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

import { ConfigurationSidebarItemActions } from "./configuration-sidebar-item-actions.tsx";

type ConfigurationSidebarItemProps = {
  readonly configuration: ConfigurationApiConfiguration;
  readonly isActive: boolean;
  readonly onDelete: (id: ConfigurationId) => void;
  readonly onSelect: (id: ConfigurationId) => void;
};

export function ConfigurationSidebarItem({
  configuration,
  isActive,
  onDelete,
  onSelect,
}: ConfigurationSidebarItemProps) {
  return (
    <SidebarMenuSubItem>
      <div
        className="flex items-stretch overflow-hidden rounded-md border border-sidebar-border/60 bg-sidebar-accent/20 transition-colors data-[active=true]:border-sidebar-accent-foreground/20 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
        data-active={isActive}
      >
        <SidebarMenuSubButton
          className="h-auto min-w-0 flex-1 flex-col items-stretch gap-0.5 rounded-r-none p-2 text-left hover:bg-transparent active:bg-transparent"
          onClick={() => {
            onSelect(configuration.id);
          }}
          render={<button type="button" />}
        >
          <span className="flex min-w-0 items-center gap-2">
            <FileTextIcon className="size-4" />
            <span className="min-w-0 flex-1 truncate">
              {configuration.label}
            </span>
          </span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {formatRelativeDateTime(configuration.updatedAt)}
          </span>
        </SidebarMenuSubButton>
        <ConfigurationSidebarItemActions
          configuration={configuration}
          isActive={isActive}
          onDelete={onDelete}
        />
      </div>
    </SidebarMenuSubItem>
  );
}
