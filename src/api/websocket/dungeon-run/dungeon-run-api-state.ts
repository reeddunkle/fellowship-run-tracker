import * as A from "effect/Array";

import {
  type DungeonRunObservationApi,
  type DungeonRunStateApi,
} from "@/api/websocket/dungeon-run/dungeon-run-api-message-schema.ts";
import { type DungeonRunProcessingState } from "@/services/fellowship/dungeon-runs/dungeon-run-processing-state.ts";

export type CreateDungeonRunApiStateOptions = {
  readonly state: DungeonRunProcessingState;
};

function createDungeonRunApiObservations(
  state: DungeonRunProcessingState,
): ReadonlyArray<DungeonRunObservationApi> {
  return A.flatMap(
    A.fromIterable(state.requirementProcessor.requirementObservations),
    ([type, observationsByTargetId]) => {
      return A.flatMap(
        A.fromIterable(observationsByTargetId),
        ([targetId, observationHistory]) => {
          return A.map(observationHistory.observations, (observation) => {
            return {
              targetId,
              timestampMilliseconds: observation.timestamp.epochMilliseconds,
              type,
            };
          });
        },
      );
    },
  );
}

export function createDungeonRunApiState({
  state,
}: CreateDungeonRunApiStateOptions): DungeonRunStateApi {
  const dungeonRun =
    state.dungeonRun === undefined
      ? null
      : {
          endedAtMilliseconds:
            "endedAt" in state.dungeonRun
              ? state.dungeonRun.endedAt.epochMilliseconds
              : null,
          startedAtMilliseconds: state.dungeonRun.startedAt.epochMilliseconds,
          status: state.dungeonRun.status,
        };

  return {
    dungeonRun,
    observations: createDungeonRunApiObservations(state),
  };
}
