import { type DungeonModel } from "@frt/db/models/dungeon-model.ts";
import { type DungeonApiDungeon } from "@frt/shared/dungeon/dungeon-api-schema.ts";

export function createDungeonApiResponse(
  dungeon: DungeonModel,
): DungeonApiDungeon {
  return {
    createdAt: dungeon.createdAt,
    id: dungeon.id,
    mapId: dungeon.mapId,
    name: dungeon.name,
    updatedAt: dungeon.updatedAt,
  };
}
