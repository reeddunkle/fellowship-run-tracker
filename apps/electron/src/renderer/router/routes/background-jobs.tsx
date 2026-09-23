import { createFileRoute } from "@tanstack/react-router";

import { BackgroundJobsPage } from "@/renderer/components/background-jobs/background-jobs-page.tsx";
import { loadFellowshipCatalogData } from "@/renderer/router/route-loaders";

function BackgroundJobsRoute() {
  const { abilities, dungeons, encounters, units } = Route.useLoaderData();

  return (
    <BackgroundJobsPage
      abilities={abilities}
      dungeons={dungeons}
      encounters={encounters}
      units={units}
    />
  );
}

export const Route = createFileRoute("/background-jobs")({
  component: BackgroundJobsRoute,
  loader: ({ context }) => {
    return loadFellowshipCatalogData(context);
  },
});
