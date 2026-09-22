import * as Config from "effect/Config";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import { appPaths } from "@frt/api/helpers/app-paths.ts";
import { getRelativePathBaseDirectory } from "@frt/api/helpers/get-app-data-directory.ts";
import { DatabaseFilenameSchema } from "@frt/api/validation/env-schema.ts";

export const getDatabaseFilename = E.fn(function* () {
  const path = yield* Path.Path;

  const databaseFilenameOverride = yield* Config.schema(
    DatabaseFilenameSchema,
    "DATABASE_FILENAME",
  ).pipe(Config.option);

  return Option.match(databaseFilenameOverride, {
    onNone: () => appPaths.databaseFile,
    onSome: (databaseFilename) => {
      return path.resolve(getRelativePathBaseDirectory(), databaseFilename);
    },
  });
});
