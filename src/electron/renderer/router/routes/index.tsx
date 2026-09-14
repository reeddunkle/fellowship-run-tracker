import { createFileRoute } from "@tanstack/react-router";
import * as E from "effect/Effect";

import { getAbilities } from "@/electron/renderer/api/ability-client.ts";
import { getConfigurations } from "@/electron/renderer/api/configuration-client.ts";
import { getDungeons } from "@/electron/renderer/api/dungeon-client.ts";
import { getEncounters } from "@/electron/renderer/api/encounter-client.ts";
import { getUnits } from "@/electron/renderer/api/unit-client.ts";
import { HomePage } from "@/electron/renderer/components/home/home-page";

function HomeRoute() {
  const { abilities, configurations, dungeons, encounters, units } =
    Route.useLoaderData();

  return (
    <HomePage
      abilities={abilities}
      configurations={configurations}
      dungeons={dungeons}
      encounters={encounters}
      units={units}
    />
  );
}

export const Route = createFileRoute("/")({
  component: HomeRoute,
  loader: ({ context }) => {
    return context.browserRuntime.runPromise(
      E.all({
        abilities: getAbilities(),
        configurations: getConfigurations(),
        dungeons: getDungeons(),
        encounters: getEncounters(),
        units: getUnits(),
      }),
    );
  },
});
