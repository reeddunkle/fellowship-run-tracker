import * as Schema from "effect/Schema";

import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

export const AbilityApiAbilitySchema = Schema.Struct({
  createdAt: Schema.DateTimeUtcFromString,
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  unitId: Schema.NullOr(NonEmptyStringSchema),
  updatedAt: Schema.DateTimeUtcFromString,
});

export type AbilityApiAbility = typeof AbilityApiAbilitySchema.Type;

export const AbilityApiAbilityListSchema = Schema.Array(
  AbilityApiAbilitySchema,
);

export type AbilityApiAbilityList = typeof AbilityApiAbilityListSchema.Type;
