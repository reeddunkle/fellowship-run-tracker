import * as Config from "effect/Config";
import * as E from "effect/Effect";
import * as Path from "effect/Path";

import { DatabaseFilenameSchema } from "@/validation/env-schema.ts";

export const getDatabaseFilename = E.fn(function* () {
  const path = yield* Path.Path;

  const databaseFilename = yield* Config.schema(
    DatabaseFilenameSchema,
    "DATABASE_FILENAME",
  );

  return path.resolve(databaseFilename);
});
