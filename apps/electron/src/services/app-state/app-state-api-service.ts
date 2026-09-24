import * as Context from "effect/Context";
import type * as E from "effect/Effect";

import { type AppState } from "@frt/shared/app-state/app-state-schema.ts";
import { type ConfigurationId } from "@frt/shared/configuration/configuration-id-schema.ts";
import { type DungeonRunComparisonGroupSchema } from "@frt/shared/dungeon-run/dungeon-run-comparison-group-schema.ts";

import { type AppStateClientError } from "@/errors/app-state-error.ts";
import { type AppStateStorageError } from "@/storage/app-state/app-state-storage.ts";

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
  "@frt/electron/services/app-state/app-state-api-service/AppStateApiService",
) {}
