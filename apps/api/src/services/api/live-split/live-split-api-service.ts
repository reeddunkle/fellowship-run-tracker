import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import { type LiveSplitClientConnectionError } from "@frt/api/errors/live-split-client-error.ts";
import { createLiveSplitApiResponse } from "@frt/api/services/api/live-split/create-live-split-api-response.ts";
import { LiveSplit } from "@frt/api/services/live-split/core/live-split-service.ts";
import { type LiveSplitApiStatus } from "@frt/shared/live-split/live-split-api-schema.ts";

export type LiveSplitApiServiceShape = {
  readonly connect: () => E.Effect<
    LiveSplitApiStatus,
    LiveSplitClientConnectionError
  >;

  readonly disconnect: () => E.Effect<LiveSplitApiStatus>;

  readonly getStatus: () => E.Effect<LiveSplitApiStatus>;

  readonly statusChanges: Stream.Stream<LiveSplitApiStatus>;
};

const makeLiveSplitApiService = E.gen(function* () {
  const liveSplit = yield* LiveSplit;

  const getStatus: LiveSplitApiServiceShape["getStatus"] = () => {
    return liveSplit.status.pipe(E.map(createLiveSplitApiResponse));
  };

  const statusChanges: LiveSplitApiServiceShape["statusChanges"] =
    liveSplit.statusChanges.pipe(Stream.map(createLiveSplitApiResponse));

  const connect: LiveSplitApiServiceShape["connect"] = () => {
    return E.gen(function* () {
      yield* liveSplit.connect();

      return yield* getStatus();
    });
  };

  const disconnect: LiveSplitApiServiceShape["disconnect"] = () => {
    return E.gen(function* () {
      yield* liveSplit.disconnect();

      return yield* getStatus();
    });
  };

  return {
    connect,
    disconnect,
    getStatus,
    statusChanges,
  } satisfies LiveSplitApiServiceShape;
});

export class LiveSplitApiService extends Context.Service<
  LiveSplitApiService,
  LiveSplitApiServiceShape
>()(
  "@frt/api/services/api/live-split/live-split-api-service/LiveSplitApiService",
) {
  static readonly layerNoDeps = Layer.effect(this, makeLiveSplitApiService);

  static readonly layer = this.layerNoDeps.pipe(Layer.provide(LiveSplit.layer));
}
