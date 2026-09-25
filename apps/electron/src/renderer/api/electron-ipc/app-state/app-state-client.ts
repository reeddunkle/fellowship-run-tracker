import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import { type AppStateRpcRequest } from "@frt/shared/app-state/app-state-rpc.ts";
import {
  type AppStateValue,
  DungeonRunTimeColumnStateSchema,
  ThemeSchema,
} from "@frt/shared/app-state/app-state-schema.ts";
import {
  type ConfigurationId,
  ConfigurationIdSchema,
} from "@frt/shared/configuration/configuration-id-schema.ts";
import { DungeonRunComparisonGroupSchema } from "@frt/shared/dungeon-run/dungeon-run-comparison-group-schema.ts";

import { AppStateClientError } from "@/errors/app-state-error.ts";

function request<Response>(
  rpcRequest: AppStateRpcRequest,
  responseSchema: Schema.Codec<Response, unknown>,
  operation: AppStateRpcRequest["_tag"],
) {
  return E.promise(() => {
    return window.electronAPI.appState.request(rpcRequest);
  }).pipe(
    E.flatMap(Schema.decodeUnknownEffect(responseSchema)),
    E.mapError((cause) => {
      return new AppStateClientError({ cause, operation });
    }),
  );
}

function command(
  rpcRequest: AppStateRpcRequest,
  operation: AppStateRpcRequest["_tag"],
) {
  return request(rpcRequest, Schema.Void, operation);
}

export const getTheme = request({ _tag: "GetTheme" }, ThemeSchema, "GetTheme");

export const getSidebarOpen = request(
  { _tag: "GetSidebarOpen" },
  Schema.Boolean,
  "GetSidebarOpen",
);

export const getSelectedConfigurationId: E.Effect<
  ConfigurationId | null,
  AppStateClientError
> = request(
  { _tag: "GetSelectedConfigurationId" },
  Schema.NullOr(ConfigurationIdSchema),
  "GetSelectedConfigurationId",
);

export const getDungeonRunTimeColumns = request(
  { _tag: "GetDungeonRunTimeColumns" },
  Schema.Array(DungeonRunTimeColumnStateSchema),
  "GetDungeonRunTimeColumns",
);

export const getDungeonRunComparisonGroup = request(
  { _tag: "GetDungeonRunComparisonGroup" },
  DungeonRunComparisonGroupSchema,
  "GetDungeonRunComparisonGroup",
);

export function setDungeonRunComparisonGroup(
  comparisonGroup: typeof DungeonRunComparisonGroupSchema.Type,
) {
  return command(
    { _tag: "SetDungeonRunComparisonGroup", comparisonGroup },
    "SetDungeonRunComparisonGroup",
  );
}

export function setDungeonRunTimeColumns(
  timeColumns: AppStateValue["dungeonRun"]["timeColumns"],
) {
  return command(
    { _tag: "SetDungeonRunTimeColumns", timeColumns },
    "SetDungeonRunTimeColumns",
  );
}

export function setSelectedConfigurationId(
  selectedConfigurationId: ConfigurationId | null,
) {
  return command(
    { _tag: "SetSelectedConfigurationId", selectedConfigurationId },
    "SetSelectedConfigurationId",
  );
}

export function setSidebarOpen(sidebarOpen: boolean) {
  return command({ _tag: "SetSidebarOpen", sidebarOpen }, "SetSidebarOpen");
}

export function setTheme(theme: AppStateValue["theme"]) {
  return command({ _tag: "SetTheme", theme }, "SetTheme");
}
