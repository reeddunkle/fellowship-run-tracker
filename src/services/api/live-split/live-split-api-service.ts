import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import { type LiveSplitApiStatus } from "@/contracts/live-split/live-split-api-schema.ts";
import { type LiveSplitConnectionError } from "@/errors/live-split-client-error.ts";
import { createLiveSplitApiResponse } from "@/services/api/live-split/create-live-split-api-response.ts";
import { LiveSplit } from "@/services/live-split/core/live-split-service.ts";

export type LiveSplitApiServiceShape = {
  readonly connect: () => E.Effect<
    LiveSplitApiStatus,
    LiveSplitConnectionError
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
  "fellowship-run-tracker/services/api/live-split/live-split-api-service/LiveSplitApiService",
) {
  static readonly layerNoDeps = Layer.effect(this, makeLiveSplitApiService);

  static readonly layerWith = (options: {
    readonly encryptionKeyDirectory: string;
  }) => {
    return this.layerNoDeps.pipe(Layer.provide(LiveSplit.layerWith(options)));
  };
}
