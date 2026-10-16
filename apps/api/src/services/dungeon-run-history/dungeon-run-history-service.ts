import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { DungeonRunApiResponseError } from "@frt/api/errors/dungeon-run-api-response-error.ts";
import { createDungeonRunApiResponse } from "@frt/api/services/dungeon-run-history/create-dungeon-run-api-response.ts";
import { type DungeonRunModel } from "@frt/db/models/dungeon-run-model.ts";
import {
  DungeonRunStore,
  type DungeonRunStoreError,
} from "@frt/db/stores/dungeon-run/dungeon-run-store.ts";
import { type DungeonRunApiHistory } from "@frt/shared/dungeon-run/dungeon-run-api-schema.ts";

type DungeonRunHistoryOptions = {
  readonly dungeonId: DungeonRunModel["dungeonId"];
  readonly dungeonLevel: DungeonRunModel["dungeonLevel"];
};

export type DungeonRunHistoryError =
  | DungeonRunApiResponseError
  | DungeonRunStoreError;

export type DungeonRunHistoryShape = {
  readonly deleteHistory: (
    options: DungeonRunHistoryOptions,
  ) => E.Effect<void, DungeonRunHistoryError>;

  readonly getHistory: (
    options: DungeonRunHistoryOptions,
  ) => E.Effect<DungeonRunApiHistory, DungeonRunHistoryError>;
};

const makeDungeonRunHistory = E.gen(function* () {
  const dungeonRunStore = yield* DungeonRunStore;

  const deleteHistory: DungeonRunHistoryShape["deleteHistory"] = E.fn(
    "DungeonRunHistory.deleteHistory",
  )(function* ({ dungeonId, dungeonLevel }) {
    return yield* dungeonRunStore.deleteHistory({
      dungeonId,
      dungeonLevel,
    });
  });

  const getHistory: DungeonRunHistoryShape["getHistory"] = E.fn(
    "DungeonRunHistory.getHistory",
  )(function* ({ dungeonId, dungeonLevel }) {
    const observations = yield* dungeonRunStore.getHistory({
      dungeonId,
      dungeonLevel,
    });

    return yield* createDungeonRunApiResponse({
      observations,
    }).pipe(
      E.mapError((cause) => {
        return new DungeonRunApiResponseError({
          cause,
        });
      }),
    );
  });

  return {
    deleteHistory,
    getHistory,
  } satisfies DungeonRunHistoryShape;
});

export class DungeonRunHistory extends Context.Service<
  DungeonRunHistory,
  DungeonRunHistoryShape
>()(
  "@frt/api/services/dungeon-run-history/dungeon-run-history-service/DungeonRunHistory",
) {
  static readonly layerNoDeps = Layer.effect(this, makeDungeonRunHistory);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(DungeonRunStore.layer),
  );
}
