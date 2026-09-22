import * as HttpApi from "effect/unstable/httpapi/HttpApi";

import { AbilitiesApi } from "@frt/api-contract/http/groups/abilities/abilities-api.ts";
import { AppSettingsApi } from "@frt/api-contract/http/groups/app-settings/app-settings-api.ts";
import { ConfigurationsApi } from "@frt/api-contract/http/groups/configurations/configurations-api.ts";
import { DungeonRunApi } from "@frt/api-contract/http/groups/dungeon-run/dungeon-run-api.ts";
import { DungeonsApi } from "@frt/api-contract/http/groups/dungeons/dungeons-api.ts";
import { EncountersApi } from "@frt/api-contract/http/groups/encounters/encounters-api.ts";
import { FellowshipLogsApi } from "@frt/api-contract/http/groups/fellowship-logs/fellowship-logs-api.ts";
import { LiveSplitApi } from "@frt/api-contract/http/groups/live-split/live-split-api.ts";
import { TrackingApi } from "@frt/api-contract/http/groups/tracking/tracking-api.ts";
import { UnitsApi } from "@frt/api-contract/http/groups/units/units-api.ts";

export const AppHttpApi = HttpApi.make("app").add(
  AbilitiesApi,
  AppSettingsApi,
  ConfigurationsApi,
  DungeonRunApi,
  DungeonsApi,
  EncountersApi,
  FellowshipLogsApi,
  LiveSplitApi,
  TrackingApi,
  UnitsApi,
);
