import { type ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@frt/ui/sidebar.tsx";

import { useSetSidebarOpen } from "@/renderer/api/app-state/app-state-mutations.ts";
import { useSidebarOpen } from "@/renderer/api/app-state/app-state-queries.ts";
import { AppHeader } from "@/renderer/components/core/app-header.tsx";

type AppLayoutProps = {
  readonly children: ReactNode;
  readonly sidebar?: ReactNode;
};

export function AppLayout({ children, sidebar }: AppLayoutProps) {
  if (sidebar === undefined) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    );
  }

  return (
    <AppLayoutWithSidebar sidebar={sidebar}>{children}</AppLayoutWithSidebar>
  );
}

function AppLayoutWithSidebar({
  children,
  sidebar,
}: AppLayoutProps & { readonly sidebar: ReactNode }) {
  const sidebarOpen = useSidebarOpen();
  const setSidebarOpen = useSetSidebarOpen();

  return (
    <SidebarProvider
      onOpenChange={setSidebarOpen}
      open={sidebarOpen}
      sidebarWidth="20rem"
    >
      {sidebar}
      <SidebarInset className="min-w-0">
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <AppHeader showSidebarTrigger />
          <div className="min-h-0 min-w-0 flex-1">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
