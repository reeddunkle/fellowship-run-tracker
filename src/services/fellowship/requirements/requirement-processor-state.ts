import type * as DateTime from "effect/DateTime";
import * as HashMap from "effect/HashMap";

import { type RequirementTargetId } from "@/services/fellowship/requirements/requirement-lookup.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";

export type RequirementObservation = {
  readonly timestamp: DateTime.Utc;
};

export type RequirementObservationHistory = {
  readonly observations: ReadonlyArray<RequirementObservation>;
};

export type RequirementObservationsByTargetId = HashMap.HashMap<
  RequirementTargetId,
  RequirementObservationHistory
>;

type RequirementObservationsByEventType = HashMap.HashMap<
  RequirementEventType,
  RequirementObservationsByTargetId
>;

export type RequirementProcessorState = {
  readonly requirementObservations: RequirementObservationsByEventType;
};

export const initialRequirementProcessorState: RequirementProcessorState = {
  requirementObservations: HashMap.empty(),
};
