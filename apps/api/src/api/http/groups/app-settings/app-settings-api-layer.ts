import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import { AppSettings } from "@frt/api/services/app-settings/app-settings-service.ts";
import { type AppSettingsStoreSetError } from "@frt/api/services/app-settings-store/app-settings-store-service.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

function mapAppSettingsApiError(
  error: AppSettingsStoreSetError,
): E.Effect<never, HttpApiError.InternalServerError> {
  return E.gen(function* () {
    yield* E.logError("App settings API operation failed.", {
      error,
    });

    return yield* new HttpApiError.InternalServerError();
  });
}

const AppSettingsApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "appSettings",
  E.fn(function* (handlers) {
    const appSettings = yield* AppSettings;

    return handlers
      .handle("getAppSettings", () => {
        return appSettings.get();
      })
      .handle("putAppSettings", ({ payload }) => {
        return appSettings.set(payload).pipe(E.catch(mapAppSettingsApiError));
      });
  }),
);

export const AppSettingsApiLayer: Layer.Layer<
  Layer.Success<typeof AppSettingsApiHandlersInferred>,
  Layer.Error<typeof AppSettingsApiHandlersInferred>,
  AppSettings
> = AppSettingsApiHandlersInferred;
