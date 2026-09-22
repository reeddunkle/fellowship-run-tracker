import * as A from "effect/Array";
import type * as DateTime from "effect/DateTime";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";

import {
  type RequirementLookup,
  type RequirementTargetId,
} from "@frt/shared/fellowship/requirements/requirement-lookup.ts";
import { type RequirementEventType } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";

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

export function getRequirementObservationHistory({
  lookup,
  state,
}: {
  readonly lookup: RequirementLookup;
  readonly state: RequirementProcessorState;
}): RequirementObservationHistory | undefined {
  return Option.flatMap(
    HashMap.get(state.requirementObservations, lookup.type),
    (observationsByTargetId) => {
      return HashMap.get(observationsByTargetId, lookup.targetId);
    },
  ).pipe(Option.getOrUndefined);
}

export function addRequirementObservation({
  lookup,
  state,
  timestamp,
}: {
  readonly lookup: RequirementLookup;
  readonly state: RequirementProcessorState;
  readonly timestamp: DateTime.Utc;
}): RequirementProcessorState {
  const observationsByTargetId = Option.getOrElse(
    HashMap.get(state.requirementObservations, lookup.type),
    () => HashMap.empty<RequirementTargetId, RequirementObservationHistory>(),
  );

  const observationHistory = Option.getOrElse(
    HashMap.get(observationsByTargetId, lookup.targetId),
    () => {
      return {
        observations: [],
      } satisfies RequirementObservationHistory;
    },
  );

  const nextObservationHistory = {
    observations: A.append(observationHistory.observations, {
      timestamp,
    }),
  } satisfies RequirementObservationHistory;

  const nextObservationsByTargetId = HashMap.set(
    observationsByTargetId,
    lookup.targetId,
    nextObservationHistory,
  );

  return {
    requirementObservations: HashMap.set(
      state.requirementObservations,
      lookup.type,
      nextObservationsByTargetId,
    ),
  };
}
