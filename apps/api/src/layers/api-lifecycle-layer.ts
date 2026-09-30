import * as E from "effect/Effect";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";

import { SESSION_STARTED_AT } from "@frt/api/helpers/session-started-at.ts";
import { AppVersion } from "@frt/api/services/app-version/app-version-service.ts";
import { BackgroundJobQueue } from "@frt/api/services/background-job-queue/background-job-queue-service.ts";

const queueStartupJobs = E.gen(function* () {
  const backgroundJobQueue = yield* BackgroundJobQueue;

  yield* backgroundJobQueue.offer({
    _tag: "InterruptUnfinishedDungeonRuns",
    createdBefore: SESSION_STARTED_AT,
  });

  yield* backgroundJobQueue.offer({ _tag: "PruneLogFiles" });

  yield* backgroundJobQueue.offer({ _tag: "PruneFellowshipLogsCache" });

  yield* backgroundJobQueue.offer({
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

  const appVersion = yield* AppVersion;

  yield* E.logInfo("Fellowship API server running.", {
    address: HttpServer.formatAddress(httpServer.address),
    appVersion,
  });

  yield* queueStartupJobs;
});

export const ApiLifecycleLayer = Layer.effectDiscard(runApiLifecycle);
