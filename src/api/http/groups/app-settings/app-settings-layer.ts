import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import { AppHttpApi } from "@/api/http/http-api.ts";
import { type AppSettingsDAOError } from "@/db/daos/app-settings/app-settings-dao.ts";
import { type EncryptionError } from "@/errors/encryption-error.ts";
import { AppSettingsApiService } from "@/services/api/app-settings/app-settings-api-service.ts";

function mapAppSettingsApiError(
  error: AppSettingsDAOError | EncryptionError,
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
