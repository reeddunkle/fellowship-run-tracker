import * as HttpApi from "effect/unstable/httpapi/HttpApi";

import { AbilitiesApi } from "@/api/http/groups/abilities/abilities-api.ts";
import { AppSettingsApi } from "@/api/http/groups/app-settings/app-settings-api.ts";
import { ConfigurationsApi } from "@/api/http/groups/configurations/configurations-api.ts";
import { DungeonsApi } from "@/api/http/groups/dungeons/dungeons-api.ts";
import { EncountersApi } from "@/api/http/groups/encounters/encounters-api.ts";
import { LiveSplitApi } from "@/api/http/groups/live-split/live-split-api.ts";
import { TrackingApi } from "@/api/http/groups/tracking/tracking-api.ts";
import { UnitsApi } from "@/api/http/groups/units/units-api.ts";

import { DungeonRunsApi } from "./groups/dungeon-runs/dungeon-runs-api.ts";

export const AppHttpApi = HttpApi.make("app").add(
  AbilitiesApi,
  AppSettingsApi,
  ConfigurationsApi,
  DungeonRunsApi,
  DungeonsApi,
  EncountersApi,
  LiveSplitApi,
  TrackingApi,
  UnitsApi,
);
