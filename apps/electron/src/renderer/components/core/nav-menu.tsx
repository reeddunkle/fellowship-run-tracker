import { Link } from "@tanstack/react-router";

import { navigationMenuTriggerStyle } from "@frt/ui/navigation-menu.tsx";

import { FellowshipLogsNavBadge } from "@/renderer/components/core/fellowship-logs-nav-badge.tsx";

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
        className={navigationMenuTriggerStyle({ className: "gap-2" })}
        to="/fellowship-logs"
      >
        Fellowship Logs
        <FellowshipLogsNavBadge />
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
