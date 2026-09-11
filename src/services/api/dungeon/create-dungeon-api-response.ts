import { type DungeonModel } from "@/db/models/dungeon-model.ts";
import { type DungeonApiDungeon } from "@/services/api/dungeon/dungeon-api-schema.ts";

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
