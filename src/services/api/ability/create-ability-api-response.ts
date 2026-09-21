import { type AbilityApiAbility } from "@/contracts/ability/ability-api-schema.ts";
import { type AbilityModel } from "@/db/models/ability-model.ts";

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
