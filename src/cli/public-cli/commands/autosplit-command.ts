import * as E from "effect/Effect";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { FellowshipTracker } from "@/application/fellowship-tracker/fellowship-tracker-service.ts";
import { DungeonDAO } from "@/db/daos/dungeon/dungeon-dao.ts";
import { AutosplitUnknownDungeonError } from "@/errors/autosplit-command-error.ts";
import { loadMilestoneConfiguration } from "@/services/fellowship/configurations/load-milestone-configuration.ts";
import { LiveSplit } from "@/services/live-split/core/live-split-service.ts";
import { generateLSSFile } from "@/services/live-split/files/lss/generate-lss-file.ts";
import { getLSSFileName } from "@/services/live-split/files/lss/get-lss-file-name.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

export const AutosplitCommandInputSchema = Schema.Struct({
  configurationFilePath: NonEmptyStringSchema,
});

export type AutosplitCommandInput = typeof AutosplitCommandInputSchema.Type;

const prepareAutosplit = E.fn("cli.autosplit.prepare")(function* (
  input: AutosplitCommandInput,
) {
  const dungeonDAO = yield* DungeonDAO;
  const liveSplit = yield* LiveSplit;
  const path = yield* Path.Path;

  const configuration = yield* loadMilestoneConfiguration({
    filePath: input.configurationFilePath,
  });

  const dungeonOption = yield* dungeonDAO.getById({
    id: configuration.dungeonId,
  });

  const dungeon = yield* E.fromOption(dungeonOption, () => {
    return new AutosplitUnknownDungeonError({
      dungeonId: configuration.dungeonId,
    });
  });

  const lssFilePath = path.resolve(
    "./generated/live-split",
    getLSSFileName(dungeon.name),
  );

  const metadata = {
    configurationFilePath: input.configurationFilePath,
    dungeonId: configuration.dungeonId,
    dungeonName: dungeon.name,
    lssFilePath,
    milestoneCount: configuration.milestones.length,
  };

  yield* E.annotateCurrentSpan("fellowship.dungeonId", configuration.dungeonId);
  yield* E.annotateCurrentSpan("fellowship.dungeon", dungeon.name);
  yield* E.annotateCurrentSpan(
    "fellowship.milestone-count",
    configuration.milestones.length,
  );

  yield* E.logInfo("Preparing Fellowship LiveSplit autosplitter.", metadata);

  yield* generateLSSFile({
    configuration,
    dungeonName: dungeon.name,
    filePath: lssFilePath,
  });

  yield* liveSplit.connect();

  // TODO: Load LSS into LiveSplit Server.

  yield* E.logInfo("Starting Fellowship LiveSplit autosplitter.", metadata);

  return {
    configuration,
  };
});

export const runAutosplitCommand = E.fn(function* (
  input: AutosplitCommandInput,
) {
  const fellowshipTracker = yield* FellowshipTracker;

  const { configuration } = yield* prepareAutosplit(input);

  yield* fellowshipTracker.startConfiguration({
    configuration,
  });

  return yield* E.never;
});
