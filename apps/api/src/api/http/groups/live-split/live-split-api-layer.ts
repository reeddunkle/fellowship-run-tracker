import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { type LiveSplitGatewayConnectionError } from "@frt/api/errors/live-split-gateway-error.ts";
import { LiveSplit } from "@frt/api/services/live-split/live-split-service.ts";
import { LiveSplitApiConnectionError } from "@frt/api-contract/errors/live-split-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

function mapLiveSplitConnectionError(
  error: LiveSplitGatewayConnectionError,
): E.Effect<never, LiveSplitApiConnectionError> {
  return E.gen(function* () {
    yield* E.logError("LiveSplit connection failed.", {
      error,
    });

    return yield* new LiveSplitApiConnectionError();
  });
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
