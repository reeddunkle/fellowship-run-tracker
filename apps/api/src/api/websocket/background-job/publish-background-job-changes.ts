import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import { BackgroundJobApiService } from "@frt/api/services/api/background-job/background-job-api-service.ts";
import { BackgroundJobWebSocketBroadcaster } from "@frt/api/services/api/websocket-broadcaster-service.ts";
import { BackgroundJobService } from "@frt/api/services/background-job/background-job-service.ts";
import { type BackgroundJobApiMessage } from "@frt/api-contract/websocket/background-job/background-job-api-message-schema.ts";

/*
 * Publishes a full snapshot of the user-visible jobs whenever any job changes.
 * `changes` starts with the current revision, so the broadcaster always has a
 * snapshot to replay to newly connected clients.
 */
export const publishBackgroundJobChanges = E.gen(function* () {
  const backgroundJobApiService = yield* BackgroundJobApiService;
  const backgroundJobService = yield* BackgroundJobService;
  const backgroundJobWebSocketBroadcaster =
    yield* BackgroundJobWebSocketBroadcaster;

  const publishSnapshot = backgroundJobApiService.getSnapshot().pipe(
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

  // Each snapshot is the full state, so while one is being published only the
  // newest pending change needs to follow it.
  yield* backgroundJobService.changes.pipe(
    Stream.buffer({ capacity: 1, strategy: "sliding" }),
    Stream.runForEach(() => {
      return publishSnapshot;
    }),
  );
});
