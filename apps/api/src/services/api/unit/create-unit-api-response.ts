import { type UnitModel } from "@frt/db/models/unit-model.ts";
import { type UnitApiUnit } from "@frt/shared/unit/unit-api-schema.ts";

export function createUnitApiResponse(unit: UnitModel): UnitApiUnit {
  return {
    createdAt: unit.createdAt,
    dungeonIds: unit.dungeonIds,
    groupKey: unit.groupKey,
    id: unit.id,
    name: unit.name,
    status: unit.status,
    updatedAt: unit.updatedAt,
    variant: unit.variant,
  };
}
