import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Stream from "effect/Stream";

import { type LiveSplitGatewayConnectionError } from "@frt/api/errors/live-split-gateway-error.ts";
import {
  DUNGEON_RUN_PROCESSING_EVENT,
  type DungeonRunProcessingEvent,
} from "@frt/api/services/fellowship/dungeon-runs/process-dungeon-run-event.ts";
import { createLiveSplitApiResponse } from "@frt/api/services/live-split/create-live-split-api-response.ts";
import { LiveSplitGateway } from "@frt/api/services/live-split-gateway/live-split-gateway-service.ts";
import { type LiveSplitApiStatus } from "@frt/shared/live-split/live-split-api-schema.ts";

export type LiveSplitShape = {
  readonly connect: () => E.Effect<
    LiveSplitApiStatus,
    LiveSplitGatewayConnectionError
  >;

  readonly disconnect: () => E.Effect<LiveSplitApiStatus>;

  readonly getStatus: () => E.Effect<LiveSplitApiStatus>;

  readonly handleRunEvent: (event: DungeonRunProcessingEvent) => E.Effect<void>;

  readonly statusChanges: Stream.Stream<LiveSplitApiStatus>;
};

const makeLiveSplit = E.gen(function* () {
  const liveSplitGateway = yield* LiveSplitGateway;

  const getStatus: LiveSplitShape["getStatus"] = () => {
    return liveSplitGateway.status.pipe(E.map(createLiveSplitApiResponse));
  };

  const statusChanges: LiveSplitShape["statusChanges"] =
    liveSplitGateway.statusChanges.pipe(Stream.map(createLiveSplitApiResponse));

  const connect: LiveSplitShape["connect"] = () => {
    return E.gen(function* () {
      yield* liveSplitGateway.connect();

      return yield* getStatus();
    });
  };

  const disconnect: LiveSplitShape["disconnect"] = () => {
    return E.gen(function* () {
      yield* liveSplitGateway.disconnect();

      return yield* getStatus();
    });
  };

  const handleRunEvent: LiveSplitShape["handleRunEvent"] = (
    processingEvent,
  ) => {
    return Match.value(processingEvent).pipe(
      Match.when(
        {
          type: DUNGEON_RUN_PROCESSING_EVENT.RUN_STARTED,
        },
        () => {
          return E.gen(function* () {
            yield* liveSplitGateway.reset();
            yield* liveSplitGateway.startTimer();
          });
        },
      ),
      Match.when(
        {
          type: DUNGEON_RUN_PROCESSING_EVENT.REQUIREMENT_SATISFIED,
        },
        () => {
          return E.void;
        },
      ),
      Match.when(
        {
          type: DUNGEON_RUN_PROCESSING_EVENT.MILESTONE_COMPLETED,
        },
        () => {
          return liveSplitGateway.split();
        },
      ),
      Match.when(
        {
          type: DUNGEON_RUN_PROCESSING_EVENT.RUN_COMPLETED,
        },
        () => {
          return liveSplitGateway.pause();
        },
      ),
      Match.when(
        {
          type: DUNGEON_RUN_PROCESSING_EVENT.RUN_EXITED,
        },
        () => {
          return liveSplitGateway.pause();
        },
      ),
      Match.exhaustive,
      E.catchTag("LiveSplitGatewayNotConnectedError", () => {
        return E.void;
      }),
      E.catch((error) => {
        return E.gen(function* () {
          yield* E.logError("LiveSplit failed to handle dungeon run event.", {
            error,
          });

          yield* liveSplitGateway.disconnect();
        });
      }),
    );
  };

  return {
    connect,
    disconnect,
    getStatus,
    handleRunEvent,
    statusChanges,
  } satisfies LiveSplitShape;
});

export class LiveSplit extends Context.Service<LiveSplit, LiveSplitShape>()(
  "@frt/api/services/live-split/live-split-service/LiveSplit",
) {
  static readonly layerNoDeps = Layer.effect(this, makeLiveSplit);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(LiveSplitGateway.layer),
  );
}
