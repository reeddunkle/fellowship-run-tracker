import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";

import { MilestoneConfigurationJsonError } from "@/errors/milestone-configuration-file-error.ts";
import { FellowshipConfigurationFileSchema } from "@/services/fellowship/validation/fellowship-configuration-file-schema.ts";
import { parseJson } from "@/util/parse-json.ts";

type LoadMilestoneConfigurationOptions = {
  readonly filePath: string;
};

export const loadMilestoneConfiguration = E.fn(
  "fellowship.load-milestone-configuration",
)(function* ({ filePath }: LoadMilestoneConfigurationOptions) {
  const fileSystem = yield* FileSystem.FileSystem;
  const contents = yield* fileSystem.readFileString(filePath);

  const json = yield* parseJson({
    contents,
    onError: (cause) => {
      return new MilestoneConfigurationJsonError({
        cause,
        filePath,
      });
    },
  });

  const configuration = yield* Schema.decodeUnknownEffect(
    FellowshipConfigurationFileSchema,
  )(json);

  yield* E.annotateCurrentSpan(
    "fellowship.dungeon-id",
    configuration.dungeonId,
  );

  yield* E.annotateCurrentSpan(
    "fellowship.dungeon-level",
    configuration.dungeonLevel,
  );

  yield* E.annotateCurrentSpan(
    "fellowship.milestone-count",
    configuration.milestones.length,
  );

  return configuration;
});
