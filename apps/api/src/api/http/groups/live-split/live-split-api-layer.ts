import * as E from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import type * as Layer from "effect/Layer";

import { LiveSplit } from "@frt/api/services/live-split/live-split-service.ts";
import { LiveSplitApiConnectionError } from "@frt/api-contract/errors/live-split-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

function mapLiveSplitConnectionError(): E.Effect<
  never,
  LiveSplitApiConnectionError
> {
  return E.fail(new LiveSplitApiConnectionError());
}

const LiveSplitApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "liveSplit",
  E.fn(function* (handlers) {
    const liveSplit = yield* LiveSplit;

    return handlers
      .handle("getLiveSplitConnection", () => {
        return liveSplit.getStatus();
      })
      .handle("connectLiveSplit", () => {
        return liveSplit.connect().pipe(E.catch(mapLiveSplitConnectionError));
      })
      .handle("disconnectLiveSplit", () => {
        return liveSplit.disconnect();
      });
  }),
);

export const LiveSplitApiLayer: Layer.Layer<
  Layer.Success<typeof LiveSplitApiHandlersInferred>,
  Layer.Error<typeof LiveSplitApiHandlersInferred>,
  LiveSplit
> = LiveSplitApiHandlersInferred;
