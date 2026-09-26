import * as Cause from "effect/Cause";
import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import { BackgroundJobWebSocketBroadcaster } from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { BackgroundJob } from "@frt/api/services/background-job/background-job-service.ts";
import { type BackgroundJobApiMessage } from "@frt/api-contract/websocket/background-job/background-job-api-message-schema.ts";
import { makeRepeatedFailureLogger } from "@frt/shared/util/make-repeated-failure-logger.ts";

export const publishBackgroundJobChanges = E.gen(function* () {
  const backgroundJob = yield* BackgroundJob;
  const backgroundJobWebSocketBroadcaster =
    yield* BackgroundJobWebSocketBroadcaster;

  const publishFailures = yield* makeRepeatedFailureLogger({
    level: "Warn",
    message: "Failed to publish background job changes.",
  });

  const publishSnapshot = backgroundJob.getSnapshot().pipe(
    E.flatMap((snapshot) => {
      const message = {
        snapshot,
        version: 1,
      } satisfies BackgroundJobApiMessage;

      return backgroundJobWebSocketBroadcaster.publish(JSON.stringify(message));
    }),
    E.andThen(publishFailures.onSuccess),
    E.catch((error) => {
      return publishFailures.onFailure(Cause.fail(error)).pipe(E.asVoid);
    }),
  );

  yield* backgroundJob.changes.pipe(
    Stream.buffer({ capacity: 1, strategy: "sliding" }),
    Stream.runForEach(() => {
      return publishSnapshot;
    }),
  );
});
