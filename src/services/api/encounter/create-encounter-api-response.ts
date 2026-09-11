import { type EncounterModel } from "@/db/models/encounter-model.ts";
import { type EncounterApiEncounter } from "@/services/api/encounter/encounter-api-schema.ts";

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
