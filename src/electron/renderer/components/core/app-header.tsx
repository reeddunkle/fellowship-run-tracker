import { NavMenu } from "@/electron/renderer/components/core/nav-menu.tsx";
import { SidebarTrigger } from "@/electron/renderer/components/ui/sidebar.tsx";

type AppHeaderProps = {
  readonly showSidebarTrigger?: boolean;
};

export function AppHeader({ showSidebarTrigger = false }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b px-4">
      {showSidebarTrigger && <SidebarTrigger />}
      <div className="ml-auto">
        <NavMenu />
      </div>
    </header>
  );
}
