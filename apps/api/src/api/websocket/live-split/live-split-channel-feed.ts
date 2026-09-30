import * as E from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { LiveSplit } from "@frt/api/services/live-split/live-split-service.ts";
import {
  type LiveSplitApiMessage,
  LiveSplitApiMessageSchema,
} from "@frt/api-contract/websocket/live-split/live-split-api-message-schema.ts";
import { type LiveSplitApiStatus } from "@frt/shared/live-split/live-split-api-schema.ts";

const encodeLiveSplitApiMessage = Schema.encodeEffect(
  Schema.fromJsonString(LiveSplitApiMessageSchema),
);

function encodeLiveSplitApiStatus(status: LiveSplitApiStatus) {
  const message = {
    status,
    version: 1,
  } satisfies LiveSplitApiMessage;

  return encodeLiveSplitApiMessage(message).pipe(
    E.map(Result.succeed),
    E.catch((error) => {
      return E.logWarning("Failed to encode LiveSplit status message.", {
        error,
      }).pipe(E.as(Result.failVoid));
    }),
  );
}

export const makeLiveSplitChannelFeed = E.gen(function* () {
  const liveSplit = yield* LiveSplit;

  return liveSplit.statusChanges.pipe(
    Stream.filterMapEffect(encodeLiveSplitApiStatus),
  );
});
