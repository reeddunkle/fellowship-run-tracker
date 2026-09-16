import "dotenv/config";

import * as Config from "effect/Config";

import {
  PublicApiHostSchema,
  PublicApiPortSchema,
} from "@/validation/app-config-schema.ts";
import {
  FellowshipLogDirectorySchema,
  FellowshipLogsClientIdSchema,
  FellowshipLogsClientSecretSchema,
  LiveSplitHostSchema,
  LiveSplitPortSchema,
} from "@/validation/app-settings/app-settings-schema.ts";
import {
  ElectronRendererHostSchema,
  ElectronRendererPortSchema,
} from "@/validation/env-schema.ts";

export const appConfig = {
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
  fellowshipLogsClientId: Config.schema(
    FellowshipLogsClientIdSchema,
    "FELLOWSHIP_LOGS_CLIENT_ID",
  ).pipe(Config.option),
  fellowshipLogsClientSecret: Config.schema(
    FellowshipLogsClientSecretSchema,
    "FELLOWSHIP_LOGS_CLIENT_SECRET",
  ).pipe(Config.option),
  liveSplitHost: Config.schema(LiveSplitHostSchema, "LIVE_SPLIT_HOST"),
  liveSplitPort: Config.schema(LiveSplitPortSchema, "LIVE_SPLIT_PORT"),
  publicApiHost: Config.schema(PublicApiHostSchema, "PUBLIC_API_HOST"),
  publicApiPort: Config.schema(PublicApiPortSchema, "PUBLIC_API_PORT"),
} as const;
