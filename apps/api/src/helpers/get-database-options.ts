import * as Config from "effect/Config";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import { appPaths } from "@frt/api/helpers/app-paths.ts";
import { getRelativePathBaseDirectory } from "@frt/api/helpers/get-app-data-directory.ts";
import { DatabaseFilenameSchema } from "@frt/api/validation/env-schema.ts";
import { type DatabaseOptions } from "@frt/db/types/database-options.ts";

const getDatabaseFilename = E.fn(function* (
  name: string,
  defaultFilename: string,
) {
  const path = yield* Path.Path;

  const databaseFilenameOverride = yield* Config.schema(
    DatabaseFilenameSchema,
    name,
  ).pipe(Config.option);

  return Option.match(databaseFilenameOverride, {
    onNone: () => defaultFilename,
    onSome: (databaseFilename) => {
      return path.resolve(getRelativePathBaseDirectory(), databaseFilename);
    },
  });
});

export const getDatabaseOptions = E.fn(function* () {
  return {
    analyticsDatabaseFilename: yield* getDatabaseFilename(
      "ANALYTICS_DATABASE_FILENAME",
      appPaths.analyticsDatabaseFile,
    ),
    databaseFilename: yield* getDatabaseFilename(
      "DATABASE_FILENAME",
      appPaths.databaseFile,
    ),
    fellowshipLogsCacheDatabaseFilename: yield* getDatabaseFilename(
      "FELLOWSHIP_LOGS_CACHE_DATABASE_FILENAME",
      appPaths.fellowshipLogsCacheDatabaseFile,
    ),
    stateDatabaseFilename: yield* getDatabaseFilename(
      "STATE_DATABASE_FILENAME",
      appPaths.stateDatabaseFile,
    ),
  } satisfies DatabaseOptions;
});
