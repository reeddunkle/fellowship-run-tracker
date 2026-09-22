import * as A from "effect/Array";
import type * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import {
  FellowshipLogsDungeonRunImportDungeonLevelNotFoundError,
  FellowshipLogsDungeonRunImportRunNotFinishedError,
  FellowshipLogsDungeonRunImportRunNotFoundError,
} from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import {
  type DungeonRunTrackerState,
  initialDungeonRunTrackerState,
  trackDungeonRunEvent,
} from "@frt/api/services/fellowship/dungeon-runs/track-dungeon-run.ts";
import {
  createDungeonRunObservation,
  type DungeonRunObservation,
} from "@frt/api/services/fellowship/requirements/create-dungeon-run-observation.ts";
import { FELLOWSHIP_EVENT } from "@frt/shared/fellowship/constants/fellowship-event.ts";
import { type DungeonStartEvent } from "@frt/shared/fellowship/validation/events/dungeon-start.ts";
import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";
import { type FellowshipLogsFightId } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

export type ProcessFellowshipLogsDungeonRunOptions<StreamError> = {
  readonly events: Stream.Stream<FellowshipEvent, StreamError>;
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
};

export type ProcessedFellowshipLogsDungeonRun = {
  readonly dungeonId: DungeonId;
  readonly dungeonLevel: number;
  readonly endedAt: DateTime.Utc;
  readonly observations: ReadonlyArray<DungeonRunObservation>;
  readonly startedAt: DateTime.Utc;
  readonly status: "COMPLETED" | "EXITED";
};

type CompletedDungeonRun = {
  readonly endedAt: DateTime.Utc;
  readonly observations: ReadonlyArray<DungeonRunObservation>;
  readonly start: DungeonStartEvent;
  readonly status: "COMPLETED" | "EXITED";
};

type ProcessingAccumulator = {
  readonly completedRun: CompletedDungeonRun | undefined;
  readonly observations: ReadonlyArray<DungeonRunObservation>;
  readonly runTracker: DungeonRunTrackerState;
};

function getEventTimestamp(event: FellowshipEvent): DateTime.Utc {
  return event.type === FELLOWSHIP_EVENT.DUNGEON_START
    ? event.startedAt
    : event.timestamp;
}

type ProcessFellowshipLogsDungeonRunError<StreamError> =
  | StreamError
  | FellowshipLogsDungeonRunImportDungeonLevelNotFoundError
  | FellowshipLogsDungeonRunImportRunNotFinishedError
  | FellowshipLogsDungeonRunImportRunNotFoundError;

export function processFellowshipLogsDungeonRun<StreamError>({
  events,
  fightId,
  reportCode,
}: ProcessFellowshipLogsDungeonRunOptions<StreamError>): E.Effect<
  ProcessedFellowshipLogsDungeonRun,
  ProcessFellowshipLogsDungeonRunError<StreamError>
> {
  return E.gen(function* () {
    const { completedRun, runTracker } = yield* events.pipe(
      Stream.runFold(
        (): ProcessingAccumulator => ({
          completedRun: undefined,
          observations: [],
          runTracker: initialDungeonRunTrackerState,
        }),
        (accumulator, event): ProcessingAccumulator => {
          const trackerResult = trackDungeonRunEvent({
            event,
            state: accumulator.runTracker,
          });

          const observations =
            trackerResult.startedRun !== undefined
              ? []
              : accumulator.observations;

          const observation = createDungeonRunObservation(event);

          const isRunActive =
            accumulator.runTracker.currentStart !== undefined ||
            trackerResult.startedRun !== undefined;

          const nextObservations =
            observation !== undefined && isRunActive
              ? A.append(observations, observation)
              : observations;

          const endedAt = getEventTimestamp(event);

          const nextCompletedRun =
            trackerResult.completedRun !== undefined
              ? {
                  endedAt,
                  observations: nextObservations,
                  start: trackerResult.completedRun.start,
                  status: "COMPLETED" as const,
                }
              : trackerResult.exitedRunStart !== undefined
                ? {
                    endedAt,
                    observations: nextObservations,
                    start: trackerResult.exitedRunStart,
                    status: "EXITED" as const,
                  }
                : accumulator.completedRun;

          return {
            completedRun: nextCompletedRun,
            observations:
              trackerResult.completedRun !== undefined ||
              trackerResult.exitedRunStart !== undefined
                ? []
                : nextObservations,
            runTracker: trackerResult.state,
          };
        },
      ),
    );

    if (completedRun !== undefined) {
      const dungeonLevel = completedRun.start.dungeonLevel;

      if (dungeonLevel === undefined) {
        return yield* new FellowshipLogsDungeonRunImportDungeonLevelNotFoundError(
          {
            fightId,
            reportCode,
          },
        );
      }

      return {
        dungeonId: completedRun.start.dungeonId,
        dungeonLevel,
        endedAt: completedRun.endedAt,
        observations: completedRun.observations,
        startedAt: completedRun.start.startedAt,
        status: completedRun.status,
      } satisfies ProcessedFellowshipLogsDungeonRun;
    }

    if (runTracker.currentStart !== undefined) {
      return yield* new FellowshipLogsDungeonRunImportRunNotFinishedError({
        fightId,
        reportCode,
      });
    }

    return yield* new FellowshipLogsDungeonRunImportRunNotFoundError({
      fightId,
      reportCode,
    });
  });
}
