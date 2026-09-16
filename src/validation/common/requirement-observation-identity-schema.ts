import * as Schema from "effect/Schema";

import { RequirementEventTypeSchema } from "@/services/fellowship/validation/requirement-event-type-schema.ts";
import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@/validation/common-schemas.ts";

const RequirementObservationIdentitySchema = Schema.Tuple([
  RequirementEventTypeSchema,
  NonEmptyStringSchema,
]);

export type RequirementObservationIdentity =
  typeof RequirementObservationIdentitySchema.Type;

const RequirementObservationOccurrenceIdentitySchema = Schema.Tuple([
  RequirementEventTypeSchema,
  NonEmptyStringSchema,
  PositiveIntegerSchema,
]);

export type RequirementObservationOccurrenceIdentity =
  typeof RequirementObservationOccurrenceIdentitySchema.Type;

export function encodeRequirementObservationIdentity(
  identity: RequirementObservationIdentity,
): string {
  return JSON.stringify(identity);
}

export function encodeRequirementObservationOccurrenceIdentity(
  identity: RequirementObservationOccurrenceIdentity,
): string {
  return JSON.stringify(identity);
}

export const RequirementObservationIdentityFromStringSchema =
  Schema.fromJsonString(RequirementObservationIdentitySchema);

export const RequirementObservationOccurrenceIdentityFromStringSchema =
  Schema.fromJsonString(RequirementObservationOccurrenceIdentitySchema);
