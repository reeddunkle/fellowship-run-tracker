import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpServer from "effect/unstable/http/HttpServer";

import { publishBackgroundJobChanges } from "@frt/api/api/websocket/background-job/publish-background-job-changes.ts";
import { publishLiveSplitStatusChanges } from "@frt/api/api/websocket/live-split/publish-live-split-status-changes.ts";
import { publishTrackingStatusChanges } from "@frt/api/api/websocket/tracking/publish-tracking-status-changes.ts";
import { SESSION_STARTED_AT } from "@frt/api/helpers/session-started-at.ts";
import { BackgroundJobService } from "@frt/api/services/background-job/background-job-service.ts";

const queueStartupJobs = E.gen(function* () {
  const backgroundJobService = yield* BackgroundJobService;

  yield* backgroundJobService.offer({
    _tag: "InterruptUnfinishedDungeonRuns",
    createdBefore: SESSION_STARTED_AT,
  });

  yield* backgroundJobService.offer({ _tag: "PruneLogFiles" });

  yield* backgroundJobService.offer({ _tag: "PruneFellowshipLogsCache" });

  yield* backgroundJobService.offer({
    _tag: "PruneFinishedBackgroundJobs",
    finishedBefore: SESSION_STARTED_AT,
  });
}).pipe(
  E.catch((error) => {
    return E.logWarning("Failed to queue startup background jobs.", {
      error,
    });
  }),
);

const runApiLifecycle = E.gen(function* () {
  const httpServer = yield* HttpServer.HttpServer;

  yield* E.logInfo("Fellowship API server running.", {
    address: HttpServer.formatAddress(httpServer.address),
  });

  yield* publishBackgroundJobChanges.pipe(E.forkScoped);
  yield* publishLiveSplitStatusChanges.pipe(E.forkScoped);
  yield* publishTrackingStatusChanges.pipe(E.forkScoped);

  yield* queueStartupJobs;
});

export const ApiLifecycleLayer = Layer.effectDiscard(runApiLifecycle);
