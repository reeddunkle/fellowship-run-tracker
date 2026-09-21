import * as A from "effect/Array";
import * as E from "effect/Effect";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";

import {
  type DungeonRunApiComparisonGroup,
  type DungeonRunApiHistory,
  type DungeonRunApiObservationStatistics,
} from "@/contracts/dungeon-run/dungeon-run-api-schema.ts";
import { type DungeonRunObservationHistory } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { getMean } from "@/util/statistics/get-mean.ts";
import { getMedian } from "@/util/statistics/get-median.ts";
import { getMinimum } from "@/util/statistics/get-minimum.ts";
import { RequirementObservationOccurrenceIdentityFromStringSchema } from "@/validation/common/requirement-observation-identity-schema.ts";

const DungeonRunApiObservationStatisticsOrder = Order.mapInput(
  Order.Tuple([Order.String, Order.String, Order.Number, Order.String]),
  (statistics: DungeonRunApiObservationStatistics) => {
    return [
      statistics.type,
      statistics.targetId,
      statistics.occurrence,
      statistics.comparisonGroup,
    ] as const;
  },
);

function countDistinctRuns(
  observations: ReadonlyArray<DungeonRunObservationHistory>,
): number {
  return new Set(
    observations.map((observation) => {
      return observation.dungeonRunId;
    }),
  ).size;
}

function sumSampleCounts(
  statistics: ReadonlyArray<DungeonRunApiObservationStatistics>,
): number {
  return statistics.reduce((total, entry) => {
    return total + entry.sampleCount;
  }, 0);
}

const encodeRequirementObservationOccurrenceIdentity = Schema.encodeEffect(
  RequirementObservationOccurrenceIdentityFromStringSchema,
);

type CreateDungeonRunApiResponseOptions = {
  readonly observations: ReadonlyArray<DungeonRunObservationHistory>;
};

export function createDungeonRunApiResponse({
  observations,
}: CreateDungeonRunApiResponseOptions) {
  return E.gen(function* () {
    const observationsByIdentity = new Map<
      string,
      Array<DungeonRunObservationHistory>
    >();

    yield* E.forEach(observations, (observation) => {
      return E.gen(function* () {
        const identity = yield* encodeRequirementObservationOccurrenceIdentity([
          observation.type,
          observation.targetId,
          observation.occurrence,
        ]);

        const existingObservations = observationsByIdentity.get(identity);

        if (existingObservations === undefined) {
          observationsByIdentity.set(identity, [observation]);

          return;
        }

        existingObservations.push(observation);
      });
    });

    const createGroupStatistics = (
      groupedObservations: ReadonlyArray<DungeonRunObservationHistory>,
      comparisonGroup: DungeonRunApiComparisonGroup,
    ): DungeonRunApiObservationStatistics | undefined => {
      const firstObservation = groupedObservations[0];

      if (firstObservation === undefined) {
        return undefined;
      }

      const elapsedMilliseconds = A.map(groupedObservations, (observation) => {
        return observation.elapsedMilliseconds;
      });

      return {
        bestElapsedMilliseconds: getMinimum(elapsedMilliseconds),
        comparisonGroup,
        meanElapsedMilliseconds: getMean(elapsedMilliseconds),
        medianElapsedMilliseconds: getMedian(elapsedMilliseconds),
        occurrence: firstObservation.occurrence,
        sampleCount: elapsedMilliseconds.length,
        targetId: firstObservation.targetId,
        type: firstObservation.type,
      };
    };

    const observationStatistics = pipe(
      A.fromIterable(observationsByIdentity.values()),
      A.flatMap((groupedObservations) => {
        const ownGroupedObservations = groupedObservations.filter(
          (observation) => {
            return observation.isOwnRun;
          },
        );

        const comparisonGroupedObservations = groupedObservations.filter(
          (observation) => {
            return !observation.isOwnRun;
          },
        );

        return A.filter(
          [
            createGroupStatistics(groupedObservations, "ALL"),
            createGroupStatistics(ownGroupedObservations, "OWN"),
            createGroupStatistics(comparisonGroupedObservations, "COMPARISON"),
          ],
          (statistics): statistics is DungeonRunApiObservationStatistics => {
            return statistics !== undefined;
          },
        );
      }),
      A.sort(DungeonRunApiObservationStatisticsOrder),
    );

    const ownObservations = observations.filter((observation) => {
      return observation.isOwnRun;
    });

    const comparisonObservations = observations.filter((observation) => {
      return !observation.isOwnRun;
    });

    const ownStatistics = observationStatistics.filter((statistics) => {
      return statistics.comparisonGroup === "OWN";
    });

    const comparisonStatistics = observationStatistics.filter((statistics) => {
      return statistics.comparisonGroup === "COMPARISON";
    });

    return {
      comparisonRunCount: countDistinctRuns(comparisonObservations),
      comparisonSampleCount: sumSampleCounts(comparisonStatistics),
      observations: observationStatistics,
      ownRunCount: countDistinctRuns(ownObservations),
      ownSampleCount: sumSampleCounts(ownStatistics),
    } satisfies DungeonRunApiHistory;
  });
}
