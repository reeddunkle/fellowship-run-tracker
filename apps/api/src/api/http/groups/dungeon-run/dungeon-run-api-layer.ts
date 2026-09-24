import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import {
  DungeonRunHistory,
  type DungeonRunHistoryError,
} from "@frt/api/services/dungeon-run-history/dungeon-run-history-service.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

function mapDungeonRunApiError(
  error: DungeonRunHistoryError,
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
    const dungeonRunHistory = yield* DungeonRunHistory;

    return handlers
      .handle("deleteDungeonRunHistory", ({ params }) => {
        return dungeonRunHistory
          .deleteHistory({
            dungeonId: params.dungeonId,
            dungeonLevel: params.dungeonLevel,
          })
          .pipe(E.catch(mapDungeonRunApiError));
      })
      .handle("getDungeonRunHistory", ({ params }) => {
        return dungeonRunHistory
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
  DungeonRunHistory
> = DungeonRunApiHandlersInferred;
