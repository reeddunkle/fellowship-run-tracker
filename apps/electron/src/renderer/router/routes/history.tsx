import { createFileRoute } from "@tanstack/react-router";

import { HistoryPage } from "@/renderer/components/history/history-page.tsx";
import { loadFellowshipCatalogData } from "@/renderer/router/route-loaders";

function HistoryRoute() {
  const { abilities, dungeons, encounters, units } = Route.useLoaderData();

  return (
    <HistoryPage
      abilities={abilities}
      dungeons={dungeons}
      encounters={encounters}
      units={units}
    />
  );
}

export const Route = createFileRoute("/history")({
  component: HistoryRoute,
  loader: ({ context }) => {
    return loadFellowshipCatalogData(context);
  },
});
