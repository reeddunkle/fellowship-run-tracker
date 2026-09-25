import * as Context from "effect/Context";
import type * as E from "effect/Effect";

import { type AppStateValue } from "@frt/shared/app-state/app-state-schema.ts";
import { type ConfigurationId } from "@frt/shared/configuration/configuration-id-schema.ts";
import { type DungeonRunComparisonGroupSchema } from "@frt/shared/dungeon-run/dungeon-run-comparison-group-schema.ts";

import { type AppStateClientError } from "@/errors/app-state-error.ts";
import { type AppStateStoreError } from "@/services/app-state-store/app-state-store-service.ts";

type AppStateError = AppStateClientError | AppStateStoreError;

export type AppStateShape = {
  readonly getDungeonRunComparisonGroup: E.Effect<
    typeof DungeonRunComparisonGroupSchema.Type,
    AppStateError
  >;
  readonly getDungeonRunTimeColumns: E.Effect<
    AppStateValue["dungeonRun"]["timeColumns"],
    AppStateError
  >;
  readonly getSelectedConfigurationId: E.Effect<
    ConfigurationId | null,
    AppStateError
  >;
  readonly getSidebarOpen: E.Effect<
    AppStateValue["sidebarOpen"],
    AppStateError
  >;
  readonly getTheme: E.Effect<AppStateValue["theme"], AppStateError>;
  readonly setDungeonRunComparisonGroup: (
    comparisonGroup: typeof DungeonRunComparisonGroupSchema.Type,
  ) => E.Effect<void, AppStateError>;
  readonly setDungeonRunTimeColumns: (
    timeColumns: AppStateValue["dungeonRun"]["timeColumns"],
  ) => E.Effect<void, AppStateError>;
  readonly setSelectedConfigurationId: (
    id: ConfigurationId | null,
  ) => E.Effect<void, AppStateError>;
  readonly setSidebarOpen: (
    sidebarOpen: AppStateValue["sidebarOpen"],
  ) => E.Effect<void, AppStateError>;
  readonly setTheme: (
    theme: AppStateValue["theme"],
  ) => E.Effect<void, AppStateError>;
};

export class AppState extends Context.Service<AppState, AppStateShape>()(
  "@frt/electron/services/app-state/app-state-service/AppState",
) {}
