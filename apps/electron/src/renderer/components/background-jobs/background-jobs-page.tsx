import { CatchBoundary } from "@tanstack/react-router";
import { Suspense } from "react";

import { type AbilityApiAbilityList } from "@frt/shared/ability/ability-api-schema.ts";
import { type DungeonApiDungeonList } from "@frt/shared/dungeon/dungeon-api-schema.ts";
import { type EncounterApiEncounterList } from "@frt/shared/encounter/encounter-api-schema.ts";
import { type UnitApiUnitList } from "@frt/shared/unit/unit-api-schema.ts";

import { useBackgroundJobGroupsSuspense } from "@/renderer/api/background-job/background-job-queries.ts";
import { AppLayout } from "@/renderer/components/core/app-layout.tsx";
import { FellowshipDataProvider } from "@/renderer/stores/fellowship-data/fellowship-data-store.tsx";

import {
  BackgroundJobItems,
  BackgroundJobListLoadError,
  BackgroundJobListSkeleton,
} from "./background-job-list.tsx";

function BackgroundJobGroups() {
  const groups = useBackgroundJobGroupsSuspense();

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing is queued or running.
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      {groups.map((group) => (
        <section className="grid gap-2" key={group.categoryId}>
          <h2 className="text-sm font-medium">{group.label}</h2>
          <BackgroundJobItems jobs={group.jobs} />
        </section>
      ))}
    </div>
  );
}

type BackgroundJobsPageProps = {
  readonly abilities: AbilityApiAbilityList;
  readonly dungeons: DungeonApiDungeonList;
  readonly encounters: EncounterApiEncounterList;
  readonly units: UnitApiUnitList;
};

export function BackgroundJobsPage({
  abilities,
  dungeons,
  encounters,
  units,
}: BackgroundJobsPageProps) {
  return (
    <FellowshipDataProvider
      abilities={abilities}
      dungeons={dungeons}
      encounters={encounters}
      units={units}
    >
      <AppLayout>
        <main className="mx-auto grid w-full max-w-5xl gap-6 p-6">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold">Background jobs</h1>
            <p className="text-sm text-muted-foreground">
              Work that runs in the background, such as Fellowship Logs imports.
            </p>
          </div>
          <CatchBoundary
            errorComponent={BackgroundJobListLoadError}
            getResetKey={() => "background-jobs"}
          >
            <Suspense fallback={<BackgroundJobListSkeleton />}>
              <BackgroundJobGroups />
            </Suspense>
          </CatchBoundary>
        </main>
      </AppLayout>
    </FellowshipDataProvider>
  );
}
