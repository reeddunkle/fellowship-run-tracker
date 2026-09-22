import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import {
  DungeonRunApiService,
  type DungeonRunApiServiceError,
} from "@frt/api/services/api/dungeon-run/dungeon-run-api-service.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

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

const DungeonRunApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "dungeonRun",
  E.fn(function* (handlers) {
    const dungeonRunApiService = yield* DungeonRunApiService;

    return handlers
      .handle("deleteDungeonRunHistory", ({ params }) => {
        return dungeonRunApiService
          .deleteHistory({
            dungeonId: params.dungeonId,
            dungeonLevel: params.dungeonLevel,
          })
          .pipe(E.catch(mapDungeonRunApiError));
      })
      .handle("getDungeonRunHistory", ({ params }) => {
        return dungeonRunApiService
          .getHistory({
            dungeonId: params.dungeonId,
            dungeonLevel: params.dungeonLevel,
          })
          .pipe(E.catch(mapDungeonRunApiError));
      });
  }),
);

export const DungeonRunApiLayer: Layer.Layer<
  Layer.Success<typeof DungeonRunApiHandlersInferred>,
  Layer.Error<typeof DungeonRunApiHandlersInferred>,
  DungeonRunApiService
> = DungeonRunApiHandlersInferred;
