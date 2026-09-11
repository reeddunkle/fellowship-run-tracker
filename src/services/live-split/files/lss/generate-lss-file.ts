import * as E from "effect/Effect";

import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";
import { LiveSplitFile } from "@/services/live-split/files/live-split-file-service.ts";

export type GenerateLSSFileOptions = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly dungeonName: string;
  readonly filePath: string;
};

export const generateLSSFile = E.fn("livesplit.generate-lss-file")(function* ({
  configuration,
  dungeonName,
  filePath,
}: GenerateLSSFileOptions) {
  const liveSplitFile = yield* LiveSplitFile;

  yield* E.annotateCurrentSpan("fellowship.dungeon", dungeonName);

  yield* E.annotateCurrentSpan(
    "fellowship.milestone-count",
    configuration.milestones.length,
  );

  yield* liveSplitFile.writeLSSFile({
    configuration,
    dungeonName,
    filePath,
  });

  return filePath;
});
