import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";

import { BackgroundJobQueue } from "@frt/api/services/background-job-queue/background-job-queue-service.ts";
import { getFellowshipLogsConnectionIdentity } from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-identity.ts";
import {
  FellowshipLogsConnection,
  type FellowshipLogsConnectionSummary,
} from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import {
  BACKGROUND_JOB_CONDITION_WAITING_REASONS,
  BACKGROUND_JOB_RESET_WAITING_REASONS,
  type BackgroundJobConditionWaitingReason,
} from "@frt/shared/background-job/background-job-waiting-reason-schema.ts";

const CURRENT_CONDITIONS = {
  CONNECTED: null,
  POINT_SYSTEM_OPT_IN_REQUIRED: "POINT_SYSTEM_OPT_IN_REQUIRED",
  REAUTHORIZATION_REQUIRED: "REAUTHORIZATION_REQUIRED",
} as const satisfies Record<
  FellowshipLogsConnectionSummary["status"],
  BackgroundJobConditionWaitingReason | null
>;

type ResumeTrigger = "ConnectionChange" | "QueueChange";

const UNOBSERVABLE_CONDITIONS: ReadonlySet<BackgroundJobConditionWaitingReason> =
  new Set(["LOCAL_PROTECTION_ACKNOWLEDGEMENT_REQUIRED"]);

const QUEUE_CHANGE_DEBOUNCE = "200 millis";

export function getFellowshipLogsWaitingReasonsToResume(
  summary: Option.Option<Pick<FellowshipLogsConnectionSummary, "status">>,
  trigger: ResumeTrigger = "ConnectionChange",
): ReadonlyArray<BackgroundJobConditionWaitingReason> {
  const currentCondition = Option.match(summary, {
    onNone: () => "CONNECTION_REQUIRED" as const,
    onSome: ({ status }) => CURRENT_CONDITIONS[status],
  });

  return BACKGROUND_JOB_CONDITION_WAITING_REASONS.filter((reason) => {
    return (
      reason !== currentCondition &&
      (trigger === "ConnectionChange" || !UNOBSERVABLE_CONDITIONS.has(reason))
    );
  });
}

const resumeWaitingJobs = E.fnUntraced(function* (trigger: ResumeTrigger) {
  const backgroundJobQueue = yield* BackgroundJobQueue;
  const connection = yield* FellowshipLogsConnection;

  const summary = yield* connection.getSummary();
  const identity = Option.match(summary, {
    onNone: () => null,
    onSome: getFellowshipLogsConnectionIdentity,
  });

  yield* backgroundJobQueue.holdWaiting({
    fromWaitingReasons: BACKGROUND_JOB_RESET_WAITING_REASONS,
    queue: "fellowship-logs-import",
    toWaitingReason: "PROFILE_CHANGE_CONFIRMATION_REQUIRED",
    unlessBindingKey: identity,
  });

  if (identity !== null) {
    yield* backgroundJobQueue.resumeWaiting({
      bindingKey: identity,
      queue: "fellowship-logs-import",
      waitingReasons: ["PROFILE_CHANGE_CONFIRMATION_REQUIRED"],
    });
  }

  const waitingReasons = getFellowshipLogsWaitingReasonsToResume(
    summary,
    trigger,
  );

  if (A.isReadonlyArrayNonEmpty(waitingReasons)) {
    yield* backgroundJobQueue.resumeWaiting({
      queue: "fellowship-logs-import",
      waitingReasons,
    });
  }
});

export const FellowshipLogsWaitingJobResumerLayer = Layer.effectDiscard(
  E.gen(function* () {
    const backgroundJobQueue = yield* BackgroundJobQueue;
    const connection = yield* FellowshipLogsConnection;
    const context = yield* E.context<
      BackgroundJobQueue | FellowshipLogsConnection
    >();

    yield* Stream.merge(
      connection.changes.pipe(
        Stream.map((): ResumeTrigger => "ConnectionChange"),
      ),
      backgroundJobQueue.changes.pipe(
        Stream.debounce(QUEUE_CHANGE_DEBOUNCE),
        Stream.map((): ResumeTrigger => "QueueChange"),
      ),
    ).pipe(
      Stream.runForEach((trigger) => {
        return resumeWaitingJobs(trigger).pipe(
          E.catch((error) => {
            return E.logWarning(
              "Couldn't update waiting Fellowship Logs jobs.",
              {
                errorTag: error._tag,
                trigger,
              },
            );
          }),
          E.provideContext(context),
        );
      }),
      E.forkScoped,
    );
  }),
);
