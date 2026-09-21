import { type EncounterApiEncounter } from "@/contracts/encounter/encounter-api-schema.ts";
import { type EncounterModel } from "@/db/models/encounter-model.ts";

export function createEncounterApiResponse(
  encounter: EncounterModel,
): EncounterApiEncounter {
  return {
    createdAt: encounter.createdAt,
    dungeonId: encounter.dungeonId,
    id: encounter.id,
    name: encounter.name,
    updatedAt: encounter.updatedAt,
  };
}
