import { createFileRoute } from "@tanstack/react-router";

import { FellowshipLogsPage } from "@/electron/renderer/components/fellowship-logs/fellowship-logs-page.tsx";
import { loadFellowshipCatalogData } from "@/electron/renderer/router/routes/route-loaders";

function FellowshipLogsRoute() {
  const { abilities, dungeons, encounters, units } = Route.useLoaderData();

  return (
    <FellowshipLogsPage
      abilities={abilities}
      dungeons={dungeons}
      encounters={encounters}
      units={units}
    />
  );
}

export const Route = createFileRoute("/fellowship-logs")({
  component: FellowshipLogsRoute,
  loader: ({ context }) => {
    return loadFellowshipCatalogData(context);
  },
});
