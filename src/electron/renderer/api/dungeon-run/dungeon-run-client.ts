import * as E from "effect/Effect";

import { AppApiClient } from "@/electron/renderer/services/app-api-client/app-api-client";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

type DeleteDungeonRunHistoryArgs = {
  readonly configurationId: ConfigurationId;
};

type GetDungeonRunHistoryArgs = {
  readonly configurationId: ConfigurationId;
};

export function deleteDungeonRunHistory({
  configurationId,
}: DeleteDungeonRunHistoryArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    yield* client.dungeonRuns.deleteDungeonRunHistory({
      params: {
        configurationId,
      },
    });
  });
}

export function getDungeonRunHistory({
  configurationId,
}: GetDungeonRunHistoryArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.dungeonRuns
      .getDungeonRunHistory({
        params: {
          configurationId,
        },
      })
      .pipe(
        E.catchTag("NotFound", () => {
          return E.succeed(null);
        }),
      );
  });
}
