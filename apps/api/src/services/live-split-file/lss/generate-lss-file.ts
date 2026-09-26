import * as E from "effect/Effect";

import { LiveSplitFile } from "@frt/api/services/live-split-file/live-split-file-service.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";

export type GenerateLSSFileOptions = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly dungeonName: string;
  readonly filePath: string;
};

export const generateLSSFile = E.fn("generateLSSFile")(function* ({
  configuration,
  dungeonName,
  filePath,
}: GenerateLSSFileOptions) {
  const liveSplitFile = yield* LiveSplitFile;

  yield* E.annotateCurrentSpan("fellowship.dungeon_name", dungeonName);

  yield* E.annotateCurrentSpan(
    "fellowship.milestone_count",
    configuration.milestones.length,
  );

  yield* liveSplitFile.writeLSSFile({
    configuration,
    dungeonName,
    filePath,
  });

  return filePath;
});
