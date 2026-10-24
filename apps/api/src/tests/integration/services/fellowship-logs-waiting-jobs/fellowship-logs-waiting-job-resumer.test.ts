import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { describe, expect, test } from "vitest";

import {
  BackgroundJobQueue,
  type BackgroundJobQueueShape,
} from "@frt/api/services/background-job-queue/background-job-queue-service.ts";
import { getFellowshipLogsConnectionIdentity } from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-identity.ts";
import {
  FellowshipLogsConnection,
  type FellowshipLogsConnectionShape,
  type FellowshipLogsConnectionSummary,
} from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import {
  FellowshipLogsWaitingJobResumerLayer,
  getFellowshipLogsWaitingReasonsToResume,
} from "@frt/api/services/fellowship-logs-waiting-jobs/fellowship-logs-waiting-job-resumer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { type BackgroundJobWaitingReason } from "@frt/shared/background-job/background-job-waiting-reason-schema.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
  FellowshipLogsConnectionGenerationSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

function makeSummary(
  status: FellowshipLogsConnectionSummary["status"],
): FellowshipLogsConnectionSummary {
  return {
    clientId: FellowshipLogsClientIdSchema.make("client-id"),
    connectedUserId: null,
    connectedUserName: null,
    generation: FellowshipLogsConnectionGenerationSchema.make(
      "7c3f4a1e-2b5d-4c8e-9f60-1a2b3c4d5e6f",
    ),
    pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
    profile: "FELLOWSHIP_RUN_TRACKER_USER",
    status,
    storageProtection: "OS_BACKED",
  };
}

describe("getFellowshipLogsWaitingReasonsToResume", () => {
  test.each([
    {
      expected: [
        "LOCAL_PROTECTION_ACKNOWLEDGEMENT_REQUIRED",
        "POINT_SYSTEM_OPT_IN_REQUIRED",
        "REAUTHORIZATION_REQUIRED",
      ],
      summary: Option.none(),
    },
    {
      expected: [
        "CONNECTION_REQUIRED",
        "LOCAL_PROTECTION_ACKNOWLEDGEMENT_REQUIRED",
        "POINT_SYSTEM_OPT_IN_REQUIRED",
        "REAUTHORIZATION_REQUIRED",
      ],
      summary: Option.some({ status: "CONNECTED" as const }),
    },
    {
      expected: [
        "CONNECTION_REQUIRED",
        "LOCAL_PROTECTION_ACKNOWLEDGEMENT_REQUIRED",
        "REAUTHORIZATION_REQUIRED",
      ],
      summary: Option.some({ status: "POINT_SYSTEM_OPT_IN_REQUIRED" as const }),
    },
    {
      expected: [
        "CONNECTION_REQUIRED",
        "LOCAL_PROTECTION_ACKNOWLEDGEMENT_REQUIRED",
        "POINT_SYSTEM_OPT_IN_REQUIRED",
      ],
      summary: Option.some({ status: "REAUTHORIZATION_REQUIRED" as const }),
    },
  ])(
    "resumes every condition wait except the current one: $summary",
    ({ expected, summary }) => {
      expect(getFellowshipLogsWaitingReasonsToResume(summary)).toEqual(
        expected,
      );
    },
  );

  test("leaves local-protection waits alone after a queue change, since the connection can't show that condition", () => {
    expect(
      getFellowshipLogsWaitingReasonsToResume(
        Option.some({ status: "CONNECTED" as const }),
        "QueueChange",
      ),
    ).toEqual([
      "CONNECTION_REQUIRED",
      "POINT_SYSTEM_OPT_IN_REQUIRED",
      "REAUTHORIZATION_REQUIRED",
    ]);
  });
});

type ResumerEvent =
  | {
      readonly _tag: "Hold";
      readonly unlessBindingKey: string | null;
    }
  | {
      readonly _tag: "Resume";
      readonly bindingKey: string | null;
      readonly waitingReasons: ReadonlyArray<BackgroundJobWaitingReason>;
    };

describe("FellowshipLogsWaitingJobResumerLayer", () => {
  test("holds quota waits from other connections, releases held jobs for this one, and resumes condition waits", async () => {
    const steps = await E.gen(function* () {
      const revisionRef = yield* SubscriptionRef.make(0);
      const summaryRef = yield* Ref.make(
        Option.none<FellowshipLogsConnectionSummary>(),
      );
      const events = yield* Queue.unbounded<ResumerEvent>();

      const unexpected = (name: string) => () =>
        E.die(`Unexpected call: ${name}.`);

      const connection: FellowshipLogsConnectionShape = {
        changes: SubscriptionRef.changes(revisionRef),
        disconnect: unexpected("disconnect"),
        getCredentials: unexpected("getCredentials"),
        getSummary: () => Ref.get(summaryRef),
        replaceTokens: unexpected("replaceTokens"),
        requireReauthorization: unexpected("requireReauthorization"),
        saveAuthorizedSession: unexpected("saveAuthorizedSession"),
        saveOwnClient: unexpected("saveOwnClient"),
        setPointSystemOptInRequired: unexpected("setPointSystemOptInRequired"),
        withRequestLease: (effect) => effect,
      };
      const backgroundJobQueue: BackgroundJobQueueShape = {
        cancel: unexpected("cancel"),
        changes: Stream.empty,
        dismiss: unexpected("dismiss"),
        holdWaiting: ({ unlessBindingKey }) =>
          Queue.offer(events, { _tag: "Hold", unlessBindingKey }).pipe(E.as(0)),
        listVisible: unexpected("listVisible"),
        offer: unexpected("offer"),
        resumeWaiting: ({ bindingKey, waitingReasons }) =>
          Queue.offer(events, {
            _tag: "Resume",
            bindingKey: bindingKey ?? null,
            waitingReasons,
          }).pipe(E.as(0)),
        resumeWaitingJob: unexpected("resumeWaitingJob"),
        retry: unexpected("retry"),
        revision: E.succeed(0),
        sessionId: "test",
      };

      const isConditionResume = (event: ResumerEvent) =>
        event._tag === "Resume" &&
        !event.waitingReasons.includes("PROFILE_CHANGE_CONFIRMATION_REQUIRED");

      const takeStep = E.gen(function* () {
        const taken: Array<ResumerEvent> = [];

        while (!taken.some(isConditionResume)) {
          taken.push(yield* Queue.take(events));
        }

        return taken.map((event) => {
          return event._tag === "Hold"
            ? `hold unless ${event.unlessBindingKey}`
            : isConditionResume(event)
              ? "resume conditions"
              : `release held for ${event.bindingKey}`;
        });
      });

      const change = (
        summary: Option.Option<FellowshipLogsConnectionSummary>,
      ) =>
        Ref.set(summaryRef, summary).pipe(
          E.andThen(
            SubscriptionRef.update(revisionRef, (revision) => revision + 1),
          ),
          E.andThen(takeStep),
        );

      yield* Layer.build(
        FellowshipLogsWaitingJobResumerLayer.pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.succeed(FellowshipLogsConnection, connection),
              Layer.succeed(BackgroundJobQueue, backgroundJobQueue),
            ),
          ),
        ),
      );

      const connected = makeSummary("CONNECTED");

      return {
        atStartup: yield* takeStep,
        connected: yield* change(Option.some(connected)),
        identity: getFellowshipLogsConnectionIdentity(connected),
      };
    }).pipe(E.scoped, E.timeout("5 seconds"), runTest);

    expect(steps.atStartup).toEqual(["hold unless null", "resume conditions"]);
    expect(steps.connected).toEqual([
      `hold unless ${steps.identity}`,
      `release held for ${steps.identity}`,
      "resume conditions",
    ]);
  });

  test("resumes a job that started waiting after the connection had already recovered", async () => {
    const resumedReasons = await E.gen(function* () {
      const queueRevisionRef = yield* SubscriptionRef.make(0);
      const resumes = yield* Queue.unbounded<ReadonlyArray<string>>();

      const unexpected = (name: string) => () =>
        E.die(`Unexpected call: ${name}.`);

      const connection: FellowshipLogsConnectionShape = {
        changes: Stream.empty,
        disconnect: unexpected("disconnect"),
        getCredentials: unexpected("getCredentials"),
        getSummary: () => E.succeedSome(makeSummary("CONNECTED")),
        replaceTokens: unexpected("replaceTokens"),
        requireReauthorization: unexpected("requireReauthorization"),
        saveAuthorizedSession: unexpected("saveAuthorizedSession"),
        saveOwnClient: unexpected("saveOwnClient"),
        setPointSystemOptInRequired: unexpected("setPointSystemOptInRequired"),
        withRequestLease: (effect) => effect,
      };
      const backgroundJobQueue: BackgroundJobQueueShape = {
        cancel: unexpected("cancel"),
        changes: SubscriptionRef.changes(queueRevisionRef),
        dismiss: unexpected("dismiss"),
        holdWaiting: () => E.succeed(0),
        listVisible: unexpected("listVisible"),
        offer: unexpected("offer"),
        resumeWaiting: ({ bindingKey, waitingReasons }) =>
          bindingKey === undefined
            ? Queue.offer(resumes, waitingReasons).pipe(E.as(0))
            : E.succeed(0),
        resumeWaitingJob: unexpected("resumeWaitingJob"),
        retry: unexpected("retry"),
        revision: SubscriptionRef.get(queueRevisionRef),
        sessionId: "test",
      };

      yield* Layer.build(
        FellowshipLogsWaitingJobResumerLayer.pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.succeed(FellowshipLogsConnection, connection),
              Layer.succeed(BackgroundJobQueue, backgroundJobQueue),
            ),
          ),
        ),
      );

      yield* Queue.take(resumes);
      yield* SubscriptionRef.update(queueRevisionRef, (revision) => {
        return revision + 1;
      });

      return yield* Queue.take(resumes);
    }).pipe(E.scoped, E.timeout("5 seconds"), runTest);

    expect(resumedReasons).toEqual([
      "CONNECTION_REQUIRED",
      "POINT_SYSTEM_OPT_IN_REQUIRED",
      "REAUTHORIZATION_REQUIRED",
    ]);
  });
});
