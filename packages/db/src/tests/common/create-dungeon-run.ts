import * as E from "effect/Effect";

import { DungeonRunDAO } from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";

export const createDungeonRun = E.fn("test.create-dungeon-run")(
  function* (options?: { readonly isOwnRun?: boolean }) {
    const dungeonRunDAO = yield* DungeonRunDAO;

    return yield* dungeonRunDAO.create({
      dungeonId: MOCK_DUNGEON_ID,
      dungeonLevel: MOCK_DUNGEON_LEVEL,
      endedAt: null,
      isOwnRun: options?.isOwnRun ?? true,
      source: "LOCAL_LOG",
      startedAt: null,
    });
  },
);
