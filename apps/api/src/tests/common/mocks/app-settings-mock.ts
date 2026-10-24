import * as Layer from "effect/Layer";

import {
  AppSettings,
  type AppSettingsShape,
} from "@frt/api/services/app-settings/app-settings-service.ts";
import { unexpectedEffectCall } from "@frt/api/tests/common/mocks/unexpected-service-call.ts";

export type MakeAppSettingsMockOptions = Partial<AppSettingsShape>;

function makeAppSettingsMock({
  get = unexpectedEffectCall("AppSettings", "get"),
  set = unexpectedEffectCall("AppSettings", "set"),
}: MakeAppSettingsMockOptions = {}) {
  return Layer.succeed(AppSettings, {
    get,
    set,
  } satisfies AppSettingsShape);
}

export const AppSettingsMock = makeAppSettingsMock();
