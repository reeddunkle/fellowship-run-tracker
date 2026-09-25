import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as Stream from "effect/Stream";

import {
  LiveSplitGatewayConnectionError,
  LiveSplitGatewayNotConnectedError,
} from "@frt/api/errors/live-split-gateway-error.ts";
import { AppSettingsStore } from "@frt/api/services/app-settings-store/app-settings-store-service.ts";
import {
  type LiveSplitGatewayClient,
  makeLiveSplitGatewayClient,
} from "@frt/api/services/live-split-gateway/live-split-gateway-client.ts";
import { LiveSplitGatewayTransportFactory } from "@frt/api/services/live-split-gateway/live-split-gateway-transport-factory-service.ts";
import {
  type ConnectionStatus,
  makeConnectionManager,
} from "@frt/api/util/connection-manager/make-connection-manager.ts";

type LiveSplitGatewayCommandName = Exclude<
  keyof LiveSplitGatewayClient,
  "unavailability"
>;

type RequireConnection<Command> = Command extends (
  ...args: infer Args
) => E.Effect<infer A, infer Error>
  ? (...args: Args) => E.Effect<A, Error | LiveSplitGatewayNotConnectedError>
  : never;

export type LiveSplitGatewayShape = {
  readonly connect: () => E.Effect<void, LiveSplitGatewayConnectionError>;

  readonly disconnect: () => E.Effect<void>;

  readonly status: E.Effect<ConnectionStatus>;

  readonly statusChanges: Stream.Stream<ConnectionStatus>;
} & {
  readonly [Command in LiveSplitGatewayCommandName]: RequireConnection<
    LiveSplitGatewayClient[Command]
  >;
};

const makeLiveSplitGateway = E.gen(function* () {
  const appSettingsStore = yield* AppSettingsStore;
  const transportFactory = yield* LiveSplitGatewayTransportFactory;

  const acquireClient = E.gen(function* () {
    const settings = yield* appSettingsStore.get();

    const host = settings.liveSplitHost;
    const port = settings.liveSplitPort;

    yield* E.logInfo("Connecting to LiveSplit.", {
      host,
      port,
    });

    const transport = yield* transportFactory.open({
      host,
      port,
    });

    yield* E.logDebug("LiveSplit transport created.", {
      host,
      port,
    });

    yield* transport.connected;

    yield* E.logDebug("LiveSplit TCP connection confirmed.", {
      host,
      port,
    });

    const client = yield* makeLiveSplitGatewayClient({
      transport,
    });

    yield* E.logDebug("LiveSplit client created.", {
      host,
      port,
    });

    return client;
  }).pipe(
    E.mapError((cause) => {
      return new LiveSplitGatewayConnectionError({
        cause,
      });
    }),
  );

  const connectionManager = yield* makeConnectionManager({
    acquire: acquireClient,
    getUnavailability: (client) => {
      return client.unavailability;
    },
    name: "LiveSplit",
  });

  const withClient = <A, Error>(
    use: (client: LiveSplitGatewayClient) => E.Effect<A, Error>,
  ): E.Effect<A, Error | LiveSplitGatewayNotConnectedError> => {
    return E.gen(function* () {
      const client = yield* connectionManager.connection;

      if (Option.isNone(client)) {
        return yield* new LiveSplitGatewayNotConnectedError();
      }

      return yield* use(client.value);
    });
  };

  return {
    connect: connectionManager.connect,
    disconnect: connectionManager.disconnect,
    getCurrentTime: () => {
      return withClient((client) => {
        return client.getCurrentTime();
      });
    },
    getSplitIndex: () => {
      return withClient((client) => {
        return client.getSplitIndex();
      });
    },
    getTimerPhase: () => {
      return withClient((client) => {
        return client.getTimerPhase();
      });
    },
    pause: () => {
      return withClient((client) => {
        return client.pause();
      });
    },
    reset: () => {
      return withClient((client) => {
        return client.reset();
      });
    },
    setComparison: (comparisonName) => {
      return withClient((client) => {
        return client.setComparison(comparisonName);
      });
    },
    setCurrentSplitName: (splitName) => {
      return withClient((client) => {
        return client.setCurrentSplitName(splitName);
      });
    },
    split: () => {
      return withClient((client) => {
        return client.split();
      });
    },
    startTimer: () => {
      return withClient((client) => {
        return client.startTimer();
      });
    },
    status: connectionManager.status,
    statusChanges: connectionManager.statusChanges,
    switchSplits: (filePath) => {
      return withClient((client) => {
        return client.switchSplits(filePath);
      });
    },
  } satisfies LiveSplitGatewayShape;
});

export class LiveSplitGateway extends Context.Service<
  LiveSplitGateway,
  LiveSplitGatewayShape
>()(
  "@frt/api/services/live-split-gateway/live-split-gateway-service/LiveSplitGateway",
) {
  static readonly layerNoDeps = Layer.effect(this, makeLiveSplitGateway);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(AppSettingsStore.layer),
    Layer.provide(LiveSplitGatewayTransportFactory.layer),
  );
}
