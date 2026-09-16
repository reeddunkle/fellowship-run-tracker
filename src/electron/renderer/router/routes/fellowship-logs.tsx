import { createFileRoute } from "@tanstack/react-router";

import { getDungeons } from "@/electron/renderer/api/dungeon/dungeon-client.ts";
import { FellowshipLogsPage } from "@/electron/renderer/components/fellowship-logs/fellowship-logs-page.tsx";

function FellowshipLogsRoute() {
  const dungeons = Route.useLoaderData();

  return <FellowshipLogsPage dungeons={dungeons} />;
}

export const Route = createFileRoute("/fellowship-logs")({
  component: FellowshipLogsRoute,
  loader: ({ context }) => {
    return context.browserRuntime.runPromise(getDungeons());
  },
});
