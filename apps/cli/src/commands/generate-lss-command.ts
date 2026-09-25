import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";

import { getDatabaseOptions } from "@frt/api/helpers/get-database-options.ts";
import { makePersistenceLayer } from "@frt/api/layers/persistence-layer.ts";
import { loadMilestoneConfiguration } from "@frt/api/services/fellowship/configurations/load-milestone-configuration.ts";
import { LiveSplitFile } from "@frt/api/services/live-split-file/live-split-file-service.ts";
import { generateLSSFile } from "@frt/api/services/live-split-file/lss/generate-lss-file.ts";
import { GenerateLSSUnknownDungeonError } from "@frt/cli/errors/generate-lss-error.ts";
import { DungeonDAO } from "@frt/db/daos/dungeon/dungeon-dao.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

const GenerateLSSLayer = Layer.unwrap(
  E.map(getDatabaseOptions(), (databaseOptions) => {
    return Layer.mergeAll(
      makePersistenceLayer(databaseOptions),
      LiveSplitFile.layer,
    );
  }),
);

type GenerateLSSCommandInput = {
  readonly configurationFilePath: string;
  readonly outputFilePath: string;
};

const runGenerateLSSCommand = E.fn("cli.generate-lss")(function* (
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

export const generateLSSCommand = Command.make(
  "generate-lss",
  {
    configurationFilePath: Flag.string("configuration").pipe(
      Flag.withAlias("c"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDescription("Milestone configuration JSON file."),
    ),
    outputFilePath: Flag.string("output").pipe(
      Flag.withAlias("o"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDescription("Where to write the LiveSplit .lss file."),
    ),
  },
  runGenerateLSSCommand,
).pipe(
  Command.withDescription(
    "Generate a LiveSplit splits file from a milestone configuration.",
  ),
  Command.provide(GenerateLSSLayer),
);
