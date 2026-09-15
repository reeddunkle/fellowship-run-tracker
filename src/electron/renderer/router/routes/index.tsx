import { createFileRoute } from "@tanstack/react-router";
import * as E from "effect/Effect";

import { getAbilities } from "@/electron/renderer/api/ability/ability-client";
import { getConfigurations } from "@/electron/renderer/api/configuration/configuration-client";
import { getDungeons } from "@/electron/renderer/api/dungeon/dungeon-client";
import { getEncounters } from "@/electron/renderer/api/encounter/encounter-client";
import { getUnits } from "@/electron/renderer/api/unit/unit-client";
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
