import * as Schema from "effect/Schema";

import {
  DungeonRunTimeColumnStateSchema,
  ThemeSchema,
} from "@frt/shared/app-state/app-state-schema.ts";
import { ConfigurationIdSchema } from "@frt/shared/configuration/configuration-id-schema.ts";
import { DungeonRunComparisonGroupSchema } from "@frt/shared/dungeon-run/dungeon-run-comparison-group-schema.ts";

export const AppStateRpcRequestSchema = Schema.TaggedUnion({
  GetDungeonRunComparisonGroup: {},
  GetDungeonRunTimeColumns: {},
  GetSelectedConfigurationId: {},
  GetSidebarOpen: {},
  GetTheme: {},
  SetDungeonRunComparisonGroup: {
    comparisonGroup: DungeonRunComparisonGroupSchema,
  },
  SetDungeonRunTimeColumns: {
    timeColumns: Schema.Array(DungeonRunTimeColumnStateSchema),
  },
  SetSelectedConfigurationId: {
    selectedConfigurationId: Schema.NullOr(ConfigurationIdSchema),
  },
  SetSidebarOpen: {
    sidebarOpen: Schema.Boolean,
  },
  SetTheme: { theme: ThemeSchema },
});

export type AppStateRpcRequest = typeof AppStateRpcRequestSchema.Type;
