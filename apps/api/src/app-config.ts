import * as Config from "effect/Config";

import {
  PublicApiHostSchema,
  PublicApiPortSchema,
} from "@frt/api/validation/app-config-schema.ts";
import { APP_CONFIG_DEFAULTS } from "@frt/shared/app-config/app-config-defaults.ts";
import {
  FellowshipLogDirectorySchema,
  FellowshipLogsClientIdSchema,
  FellowshipLogsClientSecretSchema,
  LiveSplitHostSchema,
  LiveSplitPortSchema,
} from "@frt/shared/validation/app-settings/app-settings-schema.ts";
import {
  ElectronRendererHostSchema,
  ElectronRendererPortSchema,
} from "@frt/shared/validation/electron-renderer-env-schema.ts";

export const appConfig = {
  electronRendererHost: Config.schema(
    ElectronRendererHostSchema,
    "ELECTRON_RENDERER_HOST",
  ).pipe(
    Config.withDefault(
      ElectronRendererHostSchema.make(
        APP_CONFIG_DEFAULTS.ELECTRON_RENDERER_HOST,
      ),
    ),
  ),
  electronRendererPort: Config.schema(
    ElectronRendererPortSchema,
    "ELECTRON_RENDERER_PORT",
  ).pipe(
    Config.withDefault(
      ElectronRendererPortSchema.make(
        APP_CONFIG_DEFAULTS.ELECTRON_RENDERER_PORT,
      ),
    ),
  ),
  fellowshipLogDirectory: Config.schema(
    FellowshipLogDirectorySchema,
    "FELLOWSHIP_LOG_DIRECTORY",
  ).pipe(
    Config.withDefault(
      FellowshipLogDirectorySchema.make(
        APP_CONFIG_DEFAULTS.FELLOWSHIP_LOG_DIRECTORY,
      ),
    ),
  ),
  fellowshipLogsClientId: Config.schema(
    FellowshipLogsClientIdSchema,
    "FELLOWSHIP_LOGS_CLIENT_ID",
  ).pipe(Config.option),
  fellowshipLogsClientSecret: Config.schema(
    FellowshipLogsClientSecretSchema,
    "FELLOWSHIP_LOGS_CLIENT_SECRET",
  ).pipe(Config.option),
  fellowshipLogsUseFixtures: Config.boolean(
    "FELLOWSHIP_LOGS_USE_FIXTURES",
  ).pipe(Config.withDefault(false)),
  liveSplitHost: Config.schema(LiveSplitHostSchema, "LIVE_SPLIT_HOST").pipe(
    Config.withDefault(
      LiveSplitHostSchema.make(APP_CONFIG_DEFAULTS.LIVE_SPLIT_HOST),
    ),
  ),
  liveSplitPort: Config.schema(LiveSplitPortSchema, "LIVE_SPLIT_PORT").pipe(
    Config.withDefault(
      LiveSplitPortSchema.make(APP_CONFIG_DEFAULTS.LIVE_SPLIT_PORT),
    ),
  ),
  publicApiHost: Config.schema(PublicApiHostSchema, "PUBLIC_API_HOST").pipe(
    Config.withDefault(
      PublicApiHostSchema.make(APP_CONFIG_DEFAULTS.PUBLIC_API_HOST),
    ),
  ),
  publicApiPort: Config.schema(PublicApiPortSchema, "PUBLIC_API_PORT").pipe(
    Config.withDefault(
      PublicApiPortSchema.make(APP_CONFIG_DEFAULTS.PUBLIC_API_PORT),
    ),
  ),
} as const;
