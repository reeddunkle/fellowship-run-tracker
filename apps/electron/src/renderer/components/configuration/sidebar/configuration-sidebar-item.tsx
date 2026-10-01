import { FileTextIcon } from "lucide-react";

import { type ConfigurationApiConfiguration } from "@frt/shared/configuration/configuration-api-schema.ts";
import { type ConfigurationId } from "@frt/shared/configuration/configuration-id-schema.ts";
import {
  SidebarCard,
  SidebarCardButton,
  SidebarCardDescription,
} from "@frt/ui/composites/sidebar-card.tsx";
import { SidebarMenuSubItem } from "@frt/ui/primitives/sidebar.tsx";

import { formatRelativeDateTime } from "@/util/format-date-time.ts";

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
      <SidebarCard isActive={isActive}>
        <SidebarCardButton
          onClick={() => {
            onSelect(configuration.id);
          }}
        >
          <span className="flex min-w-0 items-center gap-2">
            <FileTextIcon />
            <span className="min-w-0 flex-1 truncate">
              {configuration.label}
            </span>
          </span>
          <SidebarCardDescription>
            {formatRelativeDateTime(configuration.updatedAt)}
          </SidebarCardDescription>
        </SidebarCardButton>
        <ConfigurationSidebarItemActions
          configuration={configuration}
          onDelete={onDelete}
        />
      </SidebarCard>
    </SidebarMenuSubItem>
  );
}
