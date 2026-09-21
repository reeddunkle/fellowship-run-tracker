import { type DungeonApiDungeon } from "@/contracts/dungeon/dungeon-api-schema.ts";
import { type DungeonModel } from "@/db/models/dungeon-model.ts";

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
