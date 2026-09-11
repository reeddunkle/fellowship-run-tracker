import { type AbilityModel } from "@/db/models/ability-model.ts";
import { type AbilityApiAbility } from "@/services/api/ability/ability-api-schema.ts";

export function createAbilityApiResponse(
  ability: AbilityModel,
): AbilityApiAbility {
  return {
    createdAt: ability.createdAt,
    id: ability.id,
    name: ability.name,
    unitId: ability.unitId,
    updatedAt: ability.updatedAt,
  };
}
