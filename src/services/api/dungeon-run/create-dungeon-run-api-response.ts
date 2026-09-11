import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";

import { type DungeonRunObservationHistory } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import {
  type DungeonRunApiHistory,
  type DungeonRunApiObservationStatistics,
} from "@/services/api/dungeon-run/dungeon-run-api-schema.ts";
import {
  type RequirementObservationOccurrenceIdentity,
  RequirementObservationOccurrenceIdentityFromStringSchema,
} from "@/validation/common/requirement-observation-identity-schema.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

const DungeonRunApiObservationStatisticsOrder = Order.mapInput(
  Order.Tuple([Order.String, Order.String, Order.Number]),
  (statistics: DungeonRunApiObservationStatistics) => {
    return [
      statistics.type,
      statistics.targetId,
      statistics.occurrence,
    ] satisfies RequirementObservationOccurrenceIdentity;
  },
);

type CreateDungeonRunApiResponseOptions = {
  readonly configurationId: ConfigurationId;
  readonly observations: ReadonlyArray<DungeonRunObservationHistory>;
};

const encodeRequirementObservationOccurrenceIdentity = Schema.encodeSync(
  RequirementObservationOccurrenceIdentityFromStringSchema,
);

function getMedian(values: ReadonlyArray<number>): number {
  const sortedValues = A.sort(values, Order.Number);

  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middleIndex] ?? 0;
  }

  const lowerValue = sortedValues[middleIndex - 1] ?? 0;
  const upperValue = sortedValues[middleIndex] ?? 0;

  return (lowerValue + upperValue) / 2;
}

export function createDungeonRunApiResponse({
  configurationId,
  observations,
}: CreateDungeonRunApiResponseOptions): DungeonRunApiHistory {
  const observationsByIdentity = A.reduce(
    observations,
    new Map<string, Array<DungeonRunObservationHistory>>(),
    (accumulator, observation) => {
      const key = encodeRequirementObservationOccurrenceIdentity([
        observation.type,
        observation.targetId,
        observation.occurrence,
      ]);

      const existingObservations = accumulator.get(key);

      if (existingObservations === undefined) {
        accumulator.set(key, [observation]);

        return accumulator;
      }

      existingObservations.push(observation);

      return accumulator;
    },
  );

  const observationStatistics = pipe(
    A.fromIterable(observationsByIdentity.values()),
    A.map((groupedObservations) => {
      const firstObservation = groupedObservations[0];

      if (firstObservation === undefined) {
        return undefined;
      }

      const elapsedMilliseconds = A.map(groupedObservations, (observation) => {
        return observation.elapsedMilliseconds;
      });

      const totalElapsedMilliseconds = A.reduce(
        elapsedMilliseconds,
        0,
        (total, elapsed) => {
          return total + elapsed;
        },
      );

      return {
        bestElapsedMilliseconds: Math.min(...elapsedMilliseconds),
        meanElapsedMilliseconds:
          totalElapsedMilliseconds / elapsedMilliseconds.length,
        medianElapsedMilliseconds: getMedian(elapsedMilliseconds),
        occurrence: firstObservation.occurrence,
        sampleCount: elapsedMilliseconds.length,
        targetId: firstObservation.targetId,
        type: firstObservation.type,
      } satisfies DungeonRunApiObservationStatistics;
    }),
    A.filter((statistics): statistics is DungeonRunApiObservationStatistics => {
      return statistics !== undefined;
    }),
    A.sort(DungeonRunApiObservationStatisticsOrder),
  );

  return {
    configurationId,
    observations: observationStatistics,
  };
}
