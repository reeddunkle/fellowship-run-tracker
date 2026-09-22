import { createFileRoute } from "@tanstack/react-router";

import { FellowshipLogsPage } from "@/renderer/components/fellowship-logs/fellowship-logs-page.tsx";
import { loadFellowshipCatalogData } from "@/renderer/router/route-loaders";

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
