import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import { DungeonApiService } from "@frt/api/services/api/dungeon/dungeon-api-service.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { type DungeonDAOError } from "@frt/db/daos/dungeon/dungeon-dao.ts";

function mapDungeonApiError(
  error: DungeonDAOError,
): E.Effect<never, HttpApiError.InternalServerError> {
  return E.gen(function* () {
    yield* E.logError("Dungeon API operation failed.", {
      error,
    });

    return yield* new HttpApiError.InternalServerError();
  });
}

const DungeonsApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "dungeons",
  E.fn(function* (handlers) {
    const dungeonApiService = yield* DungeonApiService;

    return handlers
      .handle("getDungeons", () => {
        return dungeonApiService.getAll().pipe(E.catch(mapDungeonApiError));
      })
      .handle("getDungeon", ({ params }) => {
        return E.gen(function* () {
          const dungeon = yield* dungeonApiService
            .getById({
              id: params.id,
            })
            .pipe(E.catch(mapDungeonApiError));

          if (Option.isNone(dungeon)) {
            return yield* new HttpApiError.NotFound();
          }

          return dungeon.value;
        });
      });
  }),
);

export const DungeonsApiLayer: Layer.Layer<
  Layer.Success<typeof DungeonsApiHandlersInferred>,
  Layer.Error<typeof DungeonsApiHandlersInferred>,
  DungeonApiService
> = DungeonsApiHandlersInferred;
