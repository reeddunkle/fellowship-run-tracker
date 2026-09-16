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
    A.fromIterable(
      state.configuredRun.requirementProcessor.requirementObservations,
    ),
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
  const configuredDungeonRun = state.configuredRun.dungeonRun;

  const dungeonRun =
    configuredDungeonRun === undefined
      ? null
      : {
          endedAtMilliseconds:
            "endedAt" in configuredDungeonRun
              ? configuredDungeonRun.endedAt.epochMilliseconds
              : null,
          startedAtMilliseconds:
            configuredDungeonRun.startedAt.epochMilliseconds,
          status: configuredDungeonRun.status,
        };

  return {
    dungeonRun,
    observations: createDungeonRunApiObservations(state),
  };
}
