import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/electron/renderer/components/dashboard/dashboard-page.tsx";
import { loadFellowshipCatalogData } from "@/electron/renderer/router/routes/route-loaders";

function HomeRoute() {
  const { abilities, dungeons, encounters, units } = Route.useLoaderData();

  return (
    <DashboardPage
      abilities={abilities}
      dungeons={dungeons}
      encounters={encounters}
      units={units}
    />
  );
}

export const Route = createFileRoute("/")({
  component: HomeRoute,
  loader: ({ context }) => {
    return loadFellowshipCatalogData(context);
  },
});
