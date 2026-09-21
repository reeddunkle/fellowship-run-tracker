import * as Context from "effect/Context";
import type * as E from "effect/Effect";

import { type AppState } from "@/contracts/app-state/app-state-schema.ts";
import { type AppStateStorageError } from "@/electron/storage/app-state/app-state-storage.ts";
import { type AppStateClientError } from "@/errors/electron-error.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";
import { type DungeonRunComparisonGroupSchema } from "@/validation/dungeon-run/dungeon-run-comparison-group-schema.ts";

type AppStateApiError = AppStateClientError | AppStateStorageError;

export type AppStateApiServiceShape = {
  readonly getDungeonRunComparisonGroup: E.Effect<
    typeof DungeonRunComparisonGroupSchema.Type,
    AppStateApiError
  >;
  readonly getDungeonRunTimeColumns: E.Effect<
    AppState["dungeonRun"]["timeColumns"],
    AppStateApiError
  >;
  readonly getSelectedConfigurationId: E.Effect<
    ConfigurationId | null,
    AppStateApiError
  >;
  readonly getSidebarOpen: E.Effect<AppState["sidebarOpen"], AppStateApiError>;
  readonly getTheme: E.Effect<AppState["theme"], AppStateApiError>;
  readonly setDungeonRunComparisonGroup: (
    comparisonGroup: typeof DungeonRunComparisonGroupSchema.Type,
  ) => E.Effect<void, AppStateApiError>;
  readonly setDungeonRunTimeColumns: (
    timeColumns: AppState["dungeonRun"]["timeColumns"],
  ) => E.Effect<void, AppStateApiError>;
  readonly setSelectedConfigurationId: (
    id: ConfigurationId | null,
  ) => E.Effect<void, AppStateApiError>;
  readonly setSidebarOpen: (
    sidebarOpen: AppState["sidebarOpen"],
  ) => E.Effect<void, AppStateApiError>;
  readonly setTheme: (
    theme: AppState["theme"],
  ) => E.Effect<void, AppStateApiError>;
};

export class AppStateApiService extends Context.Service<
  AppStateApiService,
  AppStateApiServiceShape
>()(
  "fellowship-run-tracker/contracts/app-state/app-state-api-service/AppStateApiService",
) {}
