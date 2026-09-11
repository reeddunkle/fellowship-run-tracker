import { type ReactNode } from "react";

import { AppHeader } from "@/electron/renderer/components/core/app-header.tsx";
import {
  SidebarInset,
  SidebarProvider,
} from "@/electron/renderer/components/ui/sidebar.tsx";

type AppLayoutProps = {
  readonly children: ReactNode;
  readonly sidebar?: ReactNode;
};

export function AppLayout({ children, sidebar }: AppLayoutProps) {
  if (sidebar === undefined) {
    return (
      <div className="flex min-h-screen flex-col scrollbar-gutter-stable">
        <AppHeader />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    );
  }

  return (
    <SidebarProvider sidebarWidth="20rem">
      {sidebar}
      <SidebarInset className="min-w-0 scrollbar-gutter-stable">
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <AppHeader showSidebarTrigger />
          <div className="min-h-0 min-w-0 flex-1">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
