import * as Schema from "effect/Schema";

import { ConfigurationIdSchema } from "@/validation/configuration/configuration-id-schema.ts";
import { DungeonRunComparisonGroupSchema } from "@/validation/dungeon-run/dungeon-run-comparison-group-schema.ts";

export const DUNGEON_RUN_TIME_COLUMN = {
  AVERAGE_DELTA: "AVERAGE_DELTA",
  BEST_DELTA: "BEST_DELTA",
  GOAL_DELTA: "GOAL_DELTA",
  MEDIAN_DELTA: "MEDIAN_DELTA",
  SEGMENT: "SEGMENT",
  TOTAL: "TOTAL",
} as const;

export const DungeonRunTimeColumnSchema = Schema.Union([
  Schema.Literal(DUNGEON_RUN_TIME_COLUMN.BEST_DELTA),
  Schema.Literal(DUNGEON_RUN_TIME_COLUMN.AVERAGE_DELTA),
  Schema.Literal(DUNGEON_RUN_TIME_COLUMN.MEDIAN_DELTA),
  Schema.Literal(DUNGEON_RUN_TIME_COLUMN.GOAL_DELTA),
  Schema.Literal(DUNGEON_RUN_TIME_COLUMN.SEGMENT),
  Schema.Literal(DUNGEON_RUN_TIME_COLUMN.TOTAL),
]);

export type DungeonRunTimeColumn = typeof DungeonRunTimeColumnSchema.Type;

export const DungeonRunTimeColumnStateSchema = Schema.Struct({
  column: DungeonRunTimeColumnSchema,
  displayOrder: Schema.Finite,
  isVisible: Schema.Boolean,
});

export type DungeonRunTimeColumnState =
  typeof DungeonRunTimeColumnStateSchema.Type;

export const DungeonRunStateSchema = Schema.Struct({
  comparisonGroup: DungeonRunComparisonGroupSchema,
  timeColumns: Schema.Array(DungeonRunTimeColumnStateSchema),
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
    comparisonGroup: "OWN",
    timeColumns: [
      {
        column: DUNGEON_RUN_TIME_COLUMN.BEST_DELTA,
        displayOrder: 0,
        isVisible: true,
      },
      {
        column: DUNGEON_RUN_TIME_COLUMN.AVERAGE_DELTA,
        displayOrder: 1,
        isVisible: true,
      },
      {
        column: DUNGEON_RUN_TIME_COLUMN.MEDIAN_DELTA,
        displayOrder: 2,
        isVisible: true,
      },
      {
        column: DUNGEON_RUN_TIME_COLUMN.GOAL_DELTA,
        displayOrder: 3,
        isVisible: true,
      },
      {
        column: DUNGEON_RUN_TIME_COLUMN.SEGMENT,
        displayOrder: 4,
        isVisible: true,
      },
      {
        column: DUNGEON_RUN_TIME_COLUMN.TOTAL,
        displayOrder: 5,
        isVisible: true,
      },
    ],
  },
  selectedConfigurationId: null,
  sidebarOpen: true,
  theme: "dark",
} satisfies AppState;
