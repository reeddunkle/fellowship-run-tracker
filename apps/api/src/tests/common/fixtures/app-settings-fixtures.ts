import * as Schema from "effect/Schema";

import {
  FellowshipLogDirectorySchema,
  LiveSplitHostSchema,
  LiveSplitPortSchema,
} from "@frt/shared/validation/app-settings/app-settings-schema.ts";

export const MOCK_FELLOWSHIP_LOG_DIRECTORY = Schema.decodeSync(
  FellowshipLogDirectorySchema,
)("C:\\Fellowship\\CombatLogs");

export const MOCK_LIVE_SPLIT_HOST =
  Schema.decodeSync(LiveSplitHostSchema)("localhost");

export const MOCK_LIVE_SPLIT_PORT =
  Schema.decodeSync(LiveSplitPortSchema)(16834);
