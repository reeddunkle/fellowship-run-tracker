import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";

import { MilestoneConfigurationJsonError } from "@frt/api/errors/milestone-configuration-json-error.ts";
import { FellowshipConfigurationFileSchema } from "@frt/shared/fellowship/validation/fellowship-configuration-file-schema.ts";
import { parseJson } from "@frt/shared/util/parse-json.ts";

type LoadMilestoneConfigurationOptions = {
  readonly filePath: string;
};

export const loadMilestoneConfiguration = E.fn("loadMilestoneConfiguration")(
  function* ({ filePath }: LoadMilestoneConfigurationOptions) {
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
      "fellowship.dungeon_id",
      configuration.dungeonId,
    );

    yield* E.annotateCurrentSpan(
      "fellowship.dungeon_level",
      configuration.dungeonLevel,
    );

    yield* E.annotateCurrentSpan(
      "fellowship.milestone_count",
      configuration.milestones.length,
    );

    return configuration;
  },
);
