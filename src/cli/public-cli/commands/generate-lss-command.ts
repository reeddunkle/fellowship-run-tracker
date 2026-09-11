import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import { DungeonDAO } from "@/db/daos/dungeon/dungeon-dao.ts";
import { GenerateLSSUnknownDungeonError } from "@/errors/generate-lss-command-error.ts";
import { loadMilestoneConfiguration } from "@/services/fellowship/configurations/load-milestone-configuration.ts";
import { generateLSSFile } from "@/services/live-split/files/lss/generate-lss-file.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

export const GenerateLSSCommandInputSchema = Schema.Struct({
  configurationFilePath: NonEmptyStringSchema,
  outputFilePath: NonEmptyStringSchema,
});

export type GenerateLSSCommandInput = typeof GenerateLSSCommandInputSchema.Type;

export const runGenerateLSSCommand = E.fn("cli.generate-lss")(function* (
  input: GenerateLSSCommandInput,
) {
  const dungeonDAO = yield* DungeonDAO;

  const configuration = yield* loadMilestoneConfiguration({
    filePath: input.configurationFilePath,
  });

  const dungeonOption = yield* dungeonDAO.getById({
    id: configuration.dungeonId,
  });

  const dungeon = yield* E.fromOption(dungeonOption, () => {
    return new GenerateLSSUnknownDungeonError({
      dungeonId: configuration.dungeonId,
    });
  });

  yield* generateLSSFile({
    configuration,
    dungeonName: dungeon.name,
    filePath: input.outputFilePath,
  });

  yield* E.logInfo("Generated LiveSplit splits file.", {
    configurationFilePath: input.configurationFilePath,
    dungeonId: configuration.dungeonId,
    dungeonName: dungeon.name,
    milestoneCount: configuration.milestones.length,
    outputFilePath: input.outputFilePath,
  });
});
