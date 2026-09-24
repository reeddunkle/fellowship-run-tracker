import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import { AppSettingsApiService } from "@frt/api/services/api/app-settings/app-settings-api-service.ts";
import { type AppSettingsSetError } from "@frt/api/services/app-settings/app-settings-service.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

function mapAppSettingsApiError(
  error: AppSettingsSetError,
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
    const appSettingsApiService = yield* AppSettingsApiService;

    return handlers
      .handle("getAppSettings", () => {
        return appSettingsApiService.get();
      })
      .handle("putAppSettings", ({ payload }) => {
        return appSettingsApiService
          .set(payload)
          .pipe(E.catch(mapAppSettingsApiError));
      });
  }),
);

export const AppSettingsApiLayer: Layer.Layer<
  Layer.Success<typeof AppSettingsApiHandlersInferred>,
  Layer.Error<typeof AppSettingsApiHandlersInferred>,
  AppSettingsApiService
> = AppSettingsApiHandlersInferred;
