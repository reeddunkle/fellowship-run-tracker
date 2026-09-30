import * as Cause from "effect/Cause";
import * as E from "effect/Effect";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";

import { BackgroundJob } from "@frt/api/services/background-job/background-job-service.ts";
import { type BackgroundJobApiMessage } from "@frt/api-contract/websocket/background-job/background-job-api-message-schema.ts";
import { makeRepeatedFailureLogger } from "@frt/shared/util/make-repeated-failure-logger.ts";

export const makeBackgroundJobChannelFeed = E.gen(function* () {
  const backgroundJob = yield* BackgroundJob;

  const snapshotFailures = yield* makeRepeatedFailureLogger({
    level: "Warn",
    message: "Failed to publish background job changes.",
  });

  const encodeSnapshot = backgroundJob.getSnapshot().pipe(
    E.map((snapshot) => {
      const message = {
        snapshot,
        version: 1,
      } satisfies BackgroundJobApiMessage;

      return Result.succeed(JSON.stringify(message));
    }),
    E.tap(() => {
      return snapshotFailures.onSuccess;
    }),
    E.catch((error) => {
      return snapshotFailures
        .onFailure(Cause.fail(error))
        .pipe(E.as(Result.failVoid));
    }),
  );

  return backgroundJob.changes.pipe(
    Stream.buffer({ capacity: 1, strategy: "sliding" }),
    Stream.filterMapEffect(() => {
      return encodeSnapshot;
    }),
  );
});
