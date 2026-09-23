import * as E from "effect/Effect";
import * as PersistedQueue from "effect/unstable/persistence/PersistedQueue";

import { BackgroundJobsError } from "@frt/api/errors/background-jobs-error.ts";
import { BackgroundJobSchema } from "@frt/api/services/background-jobs/background-job-schema.ts";
import { type BackgroundJobsShape } from "@frt/api/services/background-jobs/background-jobs-service.ts";
import { getBackgroundJobIdempotencyKey } from "@frt/api/services/background-jobs/get-background-job-idempotency-key.ts";
import { runBackgroundJob } from "@frt/api/services/background-jobs/run-background-job.ts";

const BACKGROUND_JOBS_QUEUE_NAME = "background-jobs";

const MAX_ATTEMPTS = 3;

export const makeBackgroundJobs = E.gen(function* () {
  const queue = yield* PersistedQueue.make({
    name: BACKGROUND_JOBS_QUEUE_NAME,
    schema: BackgroundJobSchema,
  });

  yield* queue
    .take(
      (job, { attempts, id }) => {
        return runBackgroundJob(job).pipe(
          E.annotateLogs({ attempts, backgroundJobId: id, job: job._tag }),
        );
      },
      { maxAttempts: MAX_ATTEMPTS },
    )
    .pipe(
      E.catchCause((cause) => {
        return E.logWarning("Background job failed.", { cause });
      }),
      E.forever,
      E.forkScoped,
    );

  const offer: BackgroundJobsShape["offer"] = (job) => {
    return queue.offer(job, { id: getBackgroundJobIdempotencyKey(job) }).pipe(
      E.asVoid,
      E.mapError((cause) => {
        return new BackgroundJobsError({ cause, operation: "Offer" });
      }),
    );
  };

  return { offer } satisfies BackgroundJobsShape;
});
