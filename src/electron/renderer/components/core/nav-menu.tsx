import { Link } from "@tanstack/react-router";

import { navigationMenuTriggerStyle } from "@/electron/renderer/components/ui/navigation-menu.tsx";

export function NavMenu() {
  return (
    <nav className="flex items-center gap-1">
      <Link
        activeOptions={{
          exact: true,
        }}
        activeProps={{
          className: "bg-muted text-foreground shadow-sm",
        }}
        className={navigationMenuTriggerStyle()}
        to="/"
      >
        Dashboard
      </Link>
      <Link
        activeProps={{
          className: "bg-muted text-foreground shadow-sm",
        }}
        className={navigationMenuTriggerStyle()}
        to="/history"
      >
        History
      </Link>
      <Link
        activeProps={{
          className: "bg-muted text-foreground shadow-sm",
        }}
        className={navigationMenuTriggerStyle()}
        to="/fellowship-logs"
      >
        Fellowship Logs
      </Link>
      <Link
        activeProps={{
          className: "bg-muted text-foreground shadow-sm",
        }}
        className={navigationMenuTriggerStyle()}
        to="/settings"
      >
        Settings
      </Link>
    </nav>
  );
}
