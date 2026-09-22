import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { type LiveSplitClientConnectionError } from "@frt/api/errors/live-split-client-error.ts";
import { LiveSplitApiService } from "@frt/api/services/api/live-split/live-split-api-service.ts";
import { LiveSplitApiConnectionError } from "@frt/api-contract/errors/live-split-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

function mapLiveSplitConnectionError(
  error: LiveSplitClientConnectionError,
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
    const liveSplitApiService = yield* LiveSplitApiService;

    return handlers
      .handle("getLiveSplitConnection", () => {
        return liveSplitApiService.getStatus();
      })
      .handle("connectLiveSplit", () => {
        return liveSplitApiService
          .connect()
          .pipe(E.catch(mapLiveSplitConnectionError));
      })
      .handle("disconnectLiveSplit", () => {
        return liveSplitApiService.disconnect();
      });
  }),
);

export const LiveSplitApiLayer: Layer.Layer<
  Layer.Success<typeof LiveSplitApiHandlersInferred>,
  Layer.Error<typeof LiveSplitApiHandlersInferred>,
  LiveSplitApiService
> = LiveSplitApiHandlersInferred;
