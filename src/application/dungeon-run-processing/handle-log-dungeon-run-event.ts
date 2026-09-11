import * as E from "effect/Effect";
import * as Match from "effect/Match";

import {
  DUNGEON_RUN_PROCESSING_EVENT,
  type DungeonRunProcessingEvent,
} from "@/services/fellowship/dungeon-runs/process-dungeon-run-event.ts";

type HandleLogDungeonRunEventOptions = {
  readonly processingEvent: DungeonRunProcessingEvent;
};

export const handleLogDungeonRunEvent = E.fn(
  "fellowship.dungeon-run.handle-log-event",
)(function* ({ processingEvent }: HandleLogDungeonRunEventOptions) {
  yield* Match.value(processingEvent).pipe(
    Match.when(
      {
        type: DUNGEON_RUN_PROCESSING_EVENT.RUN_STARTED,
      },
      () => {
        return E.logInfo("Run started.", {
          runEvent: DUNGEON_RUN_PROCESSING_EVENT.RUN_STARTED,
        });
      },
    ),
    Match.when(
      {
        type: DUNGEON_RUN_PROCESSING_EVENT.REQUIREMENT_SATISFIED,
      },
      (requirementSatisfiedEvent) => {
        return E.logInfo("Requirement satisfied.", {
          milestoneId: requirementSatisfiedEvent.requirement.milestoneId,
          runEvent: DUNGEON_RUN_PROCESSING_EVENT.REQUIREMENT_SATISFIED,
        });
      },
    ),
    Match.when(
      {
        type: DUNGEON_RUN_PROCESSING_EVENT.MILESTONE_COMPLETED,
      },
      (milestoneCompletedEvent) => {
        return E.logInfo("Milestone completed.", {
          elapsedMilliseconds:
            milestoneCompletedEvent.milestone.elapsedMilliseconds,
          label: milestoneCompletedEvent.milestone.label,
          milestoneId: milestoneCompletedEvent.milestone.milestoneId,
          runEvent: DUNGEON_RUN_PROCESSING_EVENT.MILESTONE_COMPLETED,
        });
      },
    ),
    Match.when(
      {
        type: DUNGEON_RUN_PROCESSING_EVENT.RUN_COMPLETED,
      },
      () => {
        return E.logInfo("Run completed.", {
          runEvent: DUNGEON_RUN_PROCESSING_EVENT.RUN_COMPLETED,
        });
      },
    ),
    Match.when(
      {
        type: DUNGEON_RUN_PROCESSING_EVENT.RUN_EXITED,
      },
      () => {
        return E.logInfo("Run exited.", {
          runEvent: DUNGEON_RUN_PROCESSING_EVENT.RUN_EXITED,
        });
      },
    ),
    Match.exhaustive,
  );
});
