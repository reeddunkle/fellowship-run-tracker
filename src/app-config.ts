import "dotenv/config";

import * as Config from "effect/Config";

import {
  PublicApiHostSchema,
  PublicApiPortSchema,
} from "@/validation/app-config-schema.ts";
import {
  FellowshipLogDirectorySchema,
  LiveSplitHostSchema,
  LiveSplitPortSchema,
} from "@/validation/app-settings/app-settings-schema.ts";
import {
  DatabaseFilenameSchema,
  ElectronRendererHostSchema,
  ElectronRendererPortSchema,
} from "@/validation/env-schema.ts";

export const appConfig = {
  databaseFilename: Config.schema(DatabaseFilenameSchema, "DATABASE_FILENAME"),
  electronRendererHost: Config.schema(
    ElectronRendererHostSchema,
    "ELECTRON_RENDERER_HOST",
  ),
  electronRendererPort: Config.schema(
    ElectronRendererPortSchema,
    "ELECTRON_RENDERER_PORT",
  ),
  fellowshipLogDirectory: Config.schema(
    FellowshipLogDirectorySchema,
    "FELLOWSHIP_LOG_DIRECTORY",
  ),
  liveSplitsHost: Config.schema(LiveSplitHostSchema, "LIVE_SPLITS_HOST"),
  liveSplitsPort: Config.schema(LiveSplitPortSchema, "LIVE_SPLITS_PORT"),
  publicApiHost: Config.schema(PublicApiHostSchema, "PUBLIC_API_HOST"),
  publicApiPort: Config.schema(PublicApiPortSchema, "PUBLIC_API_PORT"),
} as const;
