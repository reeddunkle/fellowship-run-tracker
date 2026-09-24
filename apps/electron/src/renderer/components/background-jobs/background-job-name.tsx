import * as Match from "effect/Match";

import {
  type BackgroundJobApiItem,
  type ImportFellowshipLogsDungeonRunBackgroundJobApiItem,
} from "@frt/shared/background-job/background-job-api-schema.ts";

import { useFellowshipDataStore } from "@/renderer/stores/fellowship-data/fellowship-data-store.tsx";

function ImportJobName({
  job,
}: {
  readonly job: ImportFellowshipLogsDungeonRunBackgroundJobApiItem;
}) {
  const dungeonsById = useFellowshipDataStore((state) => state.dungeonsById);

  const dungeonName =
    dungeonsById[job.payload.dungeonId]?.name ?? job.payload.dungeonId;

  return `${dungeonName} +${job.payload.dungeonLevel}`;
}

export function BackgroundJobName({
  job,
}: {
  readonly job: BackgroundJobApiItem;
}) {
  return Match.value(job).pipe(
    Match.discriminatorsExhaustive("kind")({
      ImportFellowshipLogsDungeonRun: (importJob) => {
        return <ImportJobName job={importJob} />;
      },
    }),
  );
}
