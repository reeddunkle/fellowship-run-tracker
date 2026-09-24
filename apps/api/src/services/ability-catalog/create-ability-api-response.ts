import { type AbilityModel } from "@frt/db/models/ability-model.ts";
import { type AbilityApiAbility } from "@frt/shared/ability/ability-api-schema.ts";

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
