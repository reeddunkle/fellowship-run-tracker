import * as E from "effect/Effect";

import { createCatalogTables } from "@frt/db/migrations/main/0001-initial/catalog.ts";
import { createConfigurationTables } from "@frt/db/migrations/main/0001-initial/configuration.ts";
import { createDungeonRunTables } from "@frt/db/migrations/main/0001-initial/dungeon-run.ts";
import { createSettingsTables } from "@frt/db/migrations/main/0001-initial/settings.ts";

/*
 * Version 1 of the main database. The sections are split up only to make
 * them easier to read; together they are one migration.
 *
 * Until this version ships, edit it in place. After that, this folder is
 * frozen and schema changes go in a new migration.
 */
export const createInitialMainSchema = E.gen(function* () {
  yield* createSettingsTables;
  yield* createCatalogTables;
  yield* createConfigurationTables;
  yield* createDungeonRunTables;
});
