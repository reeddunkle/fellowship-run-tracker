import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import { BackgroundJobWebSocketBroadcaster } from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { BackgroundJob } from "@frt/api/services/background-job/background-job-service.ts";
import { type BackgroundJobApiMessage } from "@frt/api-contract/websocket/background-job/background-job-api-message-schema.ts";

export const publishBackgroundJobChanges = E.gen(function* () {
  const backgroundJob = yield* BackgroundJob;
  const backgroundJobWebSocketBroadcaster =
    yield* BackgroundJobWebSocketBroadcaster;

  const publishSnapshot = backgroundJob.getSnapshot().pipe(
    E.flatMap((snapshot) => {
      const message = {
        snapshot,
        version: 1,
      } satisfies BackgroundJobApiMessage;

      return backgroundJobWebSocketBroadcaster.publish(JSON.stringify(message));
    }),
    E.catch((error) => {
      return E.logWarning("Failed to publish background job changes.", {
        error,
      });
    }),
  );

  yield* backgroundJob.changes.pipe(
    Stream.buffer({ capacity: 1, strategy: "sliding" }),
    Stream.runForEach(() => {
      return publishSnapshot;
    }),
  );
});
