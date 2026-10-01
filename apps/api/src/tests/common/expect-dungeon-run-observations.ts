import { expect } from "vitest";

import { type DungeonRunObservationApi } from "@frt/api-contract/websocket/dungeon-run/dungeon-run-api-message-schema.ts";

type ExpectDungeonRunObservationsOptions = {
  readonly count: number;
  readonly observations: ReadonlyArray<DungeonRunObservationApi>;
  readonly targetId: DungeonRunObservationApi["targetId"];
  readonly type: DungeonRunObservationApi["type"];
};

export function expectDungeonRunObservations({
  count,
  observations,
  targetId,
  type,
}: ExpectDungeonRunObservationsOptions) {
  const matchingObservations = observations.filter((observation) => {
    return observation.type === type && observation.targetId === targetId;
  });

  const expectedObservations = Array.from({ length: count }, () => {
    return {
      targetId,
      timestampMilliseconds: expect.any(Number),
      type,
    };
  });

  expect(matchingObservations).toEqual(expectedObservations);
}
