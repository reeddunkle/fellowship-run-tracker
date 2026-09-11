import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import { AppHttpApi } from "@/api/http/http-api.ts";
import {
  DungeonRunApiService,
  type DungeonRunApiServiceError,
} from "@/services/api/dungeon-run/dungeon-run-api-service.ts";

function mapDungeonRunApiError(
  error: DungeonRunApiServiceError,
): E.Effect<never, HttpApiError.InternalServerError> {
  return E.gen(function* () {
    yield* E.logError("Dungeon run API operation failed.", {
      error,
    });

    return yield* new HttpApiError.InternalServerError();
  });
}

const DungeonRunsApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "dungeonRuns",
  E.fn(function* (handlers) {
    const dungeonRunApiService = yield* DungeonRunApiService;

    return handlers.handle("getDungeonRunHistory", ({ params }) => {
      return E.gen(function* () {
        const history = yield* dungeonRunApiService
          .getHistory({
            configurationId: params.configurationId,
          })
          .pipe(E.catch(mapDungeonRunApiError));

        if (Option.isNone(history)) {
          return yield* new HttpApiError.NotFound();
        }

        return history.value;
      });
    });
  }),
);

export const DungeonRunsApiLive: Layer.Layer<
  Layer.Success<typeof DungeonRunsApiHandlersInferred>,
  Layer.Error<typeof DungeonRunsApiHandlersInferred>,
  DungeonRunApiService
> = DungeonRunsApiHandlersInferred;
