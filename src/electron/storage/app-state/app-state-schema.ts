import * as Schema from "effect/Schema";

import { ConfigurationIdSchema } from "@/validation/configuration/configuration-id-schema.ts";

export const DUNGEON_RUN_TIME_COLUMN = {
  DELTA: "DELTA",
  SEGMENT: "SEGMENT",
  TOTAL: "TOTAL",
} as const;

export const DungeonRunTimeColumnSchema = Schema.Union([
  Schema.Literal(DUNGEON_RUN_TIME_COLUMN.DELTA),
  Schema.Literal(DUNGEON_RUN_TIME_COLUMN.SEGMENT),
  Schema.Literal(DUNGEON_RUN_TIME_COLUMN.TOTAL),
]);

export type DungeonRunTimeColumn = typeof DungeonRunTimeColumnSchema.Type;

export const DungeonRunStateSchema = Schema.Struct({
  visibleTimeColumns: Schema.Array(DungeonRunTimeColumnSchema),
});

export type DungeonRunState = typeof DungeonRunStateSchema.Type;

export const ThemeSchema = Schema.Union([
  Schema.Literal("dark"),
  Schema.Literal("light"),
  Schema.Literal("system"),
]);

export type Theme = typeof ThemeSchema.Type;

export const AppStateSchema = Schema.Struct({
  dungeonRun: DungeonRunStateSchema,
  selectedConfigurationId: Schema.NullOr(ConfigurationIdSchema),
  sidebarOpen: Schema.Boolean,
  theme: ThemeSchema,
});

export type AppState = typeof AppStateSchema.Type;

export const DEFAULT_APP_STATE: AppState = {
  dungeonRun: {
    visibleTimeColumns: [
      DUNGEON_RUN_TIME_COLUMN.DELTA,
      DUNGEON_RUN_TIME_COLUMN.SEGMENT,
      DUNGEON_RUN_TIME_COLUMN.TOTAL,
    ],
  },
  selectedConfigurationId: null,
  sidebarOpen: true,
  theme: "dark",
} satisfies AppState;
